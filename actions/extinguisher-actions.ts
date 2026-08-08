"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { saveDocumentFile, extinguisherChangeLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
import { calidadExtintorSchema } from "@/lib/vehicle-enums";
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

const createExtinguisherChangeLogSchema = z.object({
  responsable: optionalText(150),
  fechaInstalacion: requiredDate("La fecha de instalación es requerida"),
  fechaVencimiento: requiredDate("La fecha de vencimiento es requerida"),
  calidad: calidadExtintorSchema,
});

export async function createExtinguisherChangeLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createExtinguisherChangeLogSchema.safeParse({
    responsable: formData.get("responsable"),
    fechaInstalacion: formData.get("fechaInstalacion"),
    fechaVencimiento: formData.get("fechaVencimiento"),
    calidad: formData.get("calidad"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const files = readOptionalPdfFiles(formData);
  if (!Array.isArray(files)) return files;

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } }, technicalSheet: true },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  const log = await prisma.extinguisherChangeLog.create({
    data: {
      vehicleRecordId: vehicleId,
      createdById: editor.userId,
      ...parsed.data,
      // Ya no se pide por separado: el registro se considera "realizado" en
      // la fecha de instalación (ver components/admin/CreateExtinguisherChangeLogForm.tsx).
      fechaRealizacion: parsed.data.fechaInstalacion,
    },
  });

  for (const file of files) {
    const { storedName } = await saveDocumentFile(extinguisherChangeLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        extinguisherChangeLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  // Al aceptar el cambio, la ficha técnica refleja automáticamente la fecha
  // de instalación y de vencimiento del extintor nuevo. La calidad YA NO se
  // sincroniza desde aquí: es un dato que el admin controla directo en la
  // ficha técnica (ver upsertTechnicalSheet en actions/vehicle-actions.ts,
  // que es también donde vive fechaCalidadMalaExtintor/la alerta). Este
  // registro guarda su propia calidad como dato histórico de ese cambio en
  // particular, sin que afecte el estado vigente de la unidad.
  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: {
      fechaInstalacionExtintor: parsed.data.fechaInstalacion,
      fechaVencimientoExtintor: parsed.data.fechaVencimiento,
    },
    create: {
      vehicleRecordId: vehicleId,
      fechaInstalacionExtintor: parsed.data.fechaInstalacion,
      fechaVencimientoExtintor: parsed.data.fechaVencimiento,
    },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  revalidatePath("/dashboard");
  return { success: "Cambio de extintor registrado y ficha técnica actualizada." };
}

// Solo ADMIN puede corregir un registro ya guardado. No vuelve a sincronizar
// la ficha técnica (ver actions/ultrasound-actions.ts para el mismo patrón):
// si hace falta corregir también la alerta de extintor vigente, se edita
// directo la ficha técnica.
export async function updateExtinguisherChangeLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireElevatedEditor();

  const parsed = createExtinguisherChangeLogSchema.safeParse({
    responsable: formData.get("responsable"),
    fechaInstalacion: formData.get("fechaInstalacion"),
    fechaVencimiento: formData.get("fechaVencimiento"),
    calidad: formData.get("calidad"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.extinguisherChangeLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  await prisma.extinguisherChangeLog.update({
    where: { id: logId },
    // fechaRealizacion sigue a fechaInstalacion (ya no se captura aparte).
    data: { ...parsed.data, fechaRealizacion: parsed.data.fechaInstalacion },
  });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  revalidatePath("/dashboard");
  return { success: "Registro actualizado." };
}

export async function deleteExtinguisherChangeLog(logId: string) {
  await requireElevatedEditor();

  const log = await prisma.extinguisherChangeLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) return;

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("extinguisherChangeLogId", logId);
  await prisma.extinguisherChangeLog.delete({ where: { id: logId } });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  revalidatePath("/dashboard");
}
