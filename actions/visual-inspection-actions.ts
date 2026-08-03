"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { saveDocumentFile, visualInspectionLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
import type { ActionState } from "./user-actions";

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const optionalDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : null;
}, z.date().nullable());

const requiredDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : undefined;
}, z.date({ required_error: "La fecha de realización es requerida", invalid_type_error: "Fecha inválida" }));

const createVisualInspectionLogSchema = z.object({
  compania: optionalText(150),
  numeroInspeccion: optionalText(100),
  responsable: optionalText(150),
  fechaUltimaInspeccion: optionalDate,
  fechaRealizacion: requiredDate,
});

export async function createVisualInspectionLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createVisualInspectionLogSchema.safeParse({
    compania: formData.get("compania"),
    numeroInspeccion: formData.get("numeroInspeccion"),
    responsable: formData.get("responsable"),
    fechaUltimaInspeccion: formData.get("fechaUltimaInspeccion"),
    fechaRealizacion: formData.get("fechaRealizacion"),
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

  const log = await prisma.visualInspectionLog.create({
    data: {
      vehicleRecordId: vehicleId,
      createdById: editor.userId,
      ...parsed.data,
    },
  });

  for (const file of files) {
    const { storedName } = await saveDocumentFile(visualInspectionLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        visualInspectionLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  // Al aceptar el registro, la ficha técnica refleja automáticamente la
  // inspección visual externa recién realizada como la "última inspección visual externa".
  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: {
      ultimaInspeccionVisual: parsed.data.fechaRealizacion,
      ...(parsed.data.numeroInspeccion
        ? { numeroUltimaInspeccionVisual: parsed.data.numeroInspeccion }
        : {}),
    },
    create: {
      vehicleRecordId: vehicleId,
      ultimaInspeccionVisual: parsed.data.fechaRealizacion,
      numeroUltimaInspeccionVisual: parsed.data.numeroInspeccion,
    },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Inspección visual externa registrada y ficha técnica actualizada." };
}

export async function deleteVisualInspectionLog(logId: string) {
  await requireAdmin();

  const log = await prisma.visualInspectionLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) return;

  await prisma.visualInspectionLog.delete({ where: { id: logId } });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
}
