"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { saveDocumentFile, visualInspectionLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
import { deleteLogDocumentFiles } from "@/lib/document-cleanup";
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

const requiredProximaDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : undefined;
}, z.date({ required_error: "La fecha de la próxima inspección es requerida", invalid_type_error: "Fecha inválida" }));

const createVisualInspectionLogSchema = z.object({
  compania: optionalText(150),
  numeroInspeccion: optionalText(100),
  responsable: optionalText(150),
  fechaUltimaInspeccion: optionalDate,
  fechaRealizacion: requiredDate,
  fechaProximaInspeccion: requiredProximaDate,
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
    fechaProximaInspeccion: formData.get("fechaProximaInspeccion"),
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
  // inspección visual externa recién realizada como la "última inspección
  // visual externa" y la fecha capturada como la "próxima" (la que dispara
  // la alerta).
  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: {
      ultimaInspeccionVisual: parsed.data.fechaRealizacion,
      fechaProximaInspeccionVisual: parsed.data.fechaProximaInspeccion,
      ...(parsed.data.numeroInspeccion
        ? { numeroUltimaInspeccionVisual: parsed.data.numeroInspeccion }
        : {}),
    },
    create: {
      vehicleRecordId: vehicleId,
      ultimaInspeccionVisual: parsed.data.fechaRealizacion,
      fechaProximaInspeccionVisual: parsed.data.fechaProximaInspeccion,
      numeroUltimaInspeccionVisual: parsed.data.numeroInspeccion,
    },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Inspección visual externa registrada y ficha técnica actualizada." };
}

// Solo ADMIN puede corregir un registro ya guardado. No vuelve a sincronizar
// la ficha técnica (ver actions/ultrasound-actions.ts para el mismo patrón).
export async function updateVisualInspectionLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireElevatedEditor();

  const parsed = createVisualInspectionLogSchema.safeParse({
    compania: formData.get("compania"),
    numeroInspeccion: formData.get("numeroInspeccion"),
    responsable: formData.get("responsable"),
    fechaUltimaInspeccion: formData.get("fechaUltimaInspeccion"),
    fechaRealizacion: formData.get("fechaRealizacion"),
    fechaProximaInspeccion: formData.get("fechaProximaInspeccion"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.visualInspectionLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  await prisma.visualInspectionLog.update({ where: { id: logId }, data: parsed.data });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  return { success: "Registro actualizado." };
}

export async function deleteVisualInspectionLog(logId: string) {
  await requireElevatedEditor();

  const log = await prisma.visualInspectionLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) return;

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("visualInspectionLogId", logId);
  await prisma.visualInspectionLog.delete({ where: { id: logId } });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
}
