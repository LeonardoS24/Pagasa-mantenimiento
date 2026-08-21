"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { saveDocumentFile, hoseChangeLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
import { deleteLogDocumentFiles } from "@/lib/document-cleanup";
import type { ActionState } from "./user-actions";

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const requiredDate = (message: string) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? new Date(text) : undefined;
  }, z.date({ required_error: message, invalid_type_error: "Fecha inválida" }));

const createHoseChangeLogSchema = z.object({
  responsable: optionalText(150),
  fechaInstalacion: requiredDate("La fecha de instalación es requerida"),
  fechaFabricacionManguera: requiredDate("La fecha de fabricación de la manguera es requerida"),
});

export async function createHoseChangeLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createHoseChangeLogSchema.safeParse({
    responsable: formData.get("responsable"),
    fechaInstalacion: formData.get("fechaInstalacion"),
    fechaFabricacionManguera: formData.get("fechaFabricacionManguera"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const files = readOptionalPdfFiles(formData);
  if (!Array.isArray(files)) return files;

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  // El rol dice si puede editar, no si puede editar ESTO: vehicleId llega
  // del navegador y esta acción es un endpoint llamable directo, así que sin
  // esto un USUARIO de una ciudad podía escribir en la bitácora de otra
  // (ver lib/access.ts).
  await assertCityAccessById(editor, vehicle.section.cityId);

  const log = await prisma.hoseChangeLog.create({
    data: {
      vehicleRecordId: vehicleId,
      createdById: editor.userId,
      ...parsed.data,
    },
  });

  for (const file of files) {
    const { storedName } = await saveDocumentFile(hoseChangeLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        hoseChangeLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  // Al aceptar el cambio, la ficha técnica refleja automáticamente la fecha
  // de fabricación y la fecha general de instalación de la nueva manguera
  // (mismo patrón que válvulas: siempre se sobrescribe con lo más reciente).
  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: {
      fechaInstalacionMangueras: parsed.data.fechaInstalacion,
      fechaFabricacionManguera: parsed.data.fechaFabricacionManguera,
    },
    create: {
      vehicleRecordId: vehicleId,
      fechaInstalacionMangueras: parsed.data.fechaInstalacion,
      fechaFabricacionManguera: parsed.data.fechaFabricacionManguera,
    },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  revalidatePath("/dashboard");
  return { success: "Cambio de mangueras registrado y ficha técnica actualizada." };
}

// Solo ADMIN puede corregir un registro ya guardado. No vuelve a sincronizar
// la ficha técnica (ver actions/ultrasound-actions.ts para el mismo patrón).
export async function updateHoseChangeLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireElevatedEditor();

  const parsed = createHoseChangeLogSchema.safeParse({
    responsable: formData.get("responsable"),
    fechaInstalacion: formData.get("fechaInstalacion"),
    fechaFabricacionManguera: formData.get("fechaFabricacionManguera"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.hoseChangeLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }
  // Ver lib/access.ts: el rol dice si puede editar, no si puede editar ESTO.
  await assertCityAccessById(editor, log.vehicleRecord.section.cityId);

  await prisma.hoseChangeLog.update({ where: { id: logId }, data: parsed.data });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  revalidatePath("/dashboard");
  return { success: "Registro actualizado." };
}

export async function deleteHoseChangeLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const log = await prisma.hoseChangeLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro ya no existe." };
  }
  // Ver lib/access.ts: el rol dice si puede editar, no si puede editar ESTO.
  await assertCityAccessById(admin, log.vehicleRecord.section.cityId);

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Cambio de mangueras",
    resumen: log.vehicleRecord.numeroEconomico,
    citySlug: log.vehicleRecord.section.city.slug,
  });

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("hoseChangeLogId", logId);
  await prisma.hoseChangeLog.delete({ where: { id: logId } });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  revalidatePath("/dashboard");
  return { success: "Registro eliminado." };
}
