"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { saveDocumentFile, hoseChangeLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
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

export async function deleteHoseChangeLog(logId: string) {
  await requireAdmin();

  const log = await prisma.hoseChangeLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) return;

  await prisma.hoseChangeLog.delete({ where: { id: logId } });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  revalidatePath("/dashboard");
}
