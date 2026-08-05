"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor, checkSessionUserExists } from "@/lib/auth";
import {
  saveDocumentFile,
  internalVisualInspectionLogOwnerKey,
  readOptionalPdfFiles,
} from "@/lib/documents";
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

const createInternalVisualInspectionLogSchema = z.object({
  compania: optionalText(150),
  numeroInspeccion: optionalText(100),
  responsable: optionalText(150),
  fechaUltimaInspeccion: optionalDate,
  fechaRealizacion: requiredDate,
});

function addTenYears(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + 10, date.getUTCMonth(), date.getUTCDate()));
}

export async function createInternalVisualInspectionLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createInternalVisualInspectionLogSchema.safeParse({
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

  const log = await prisma.internalVisualInspectionLog.create({
    data: {
      vehicleRecordId: vehicleId,
      createdById: editor.userId,
      ...parsed.data,
    },
  });

  for (const file of files) {
    const { storedName } = await saveDocumentFile(internalVisualInspectionLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        internalVisualInspectionLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  // A diferencia de ultrasonido/visual externa/hermeticidad, aquí SÍ se
  // recalcula automáticamente la fecha próxima: este ciclo vence cada 10
  // años, así que el siguiente vencimiento es fechaRealizacion + 10 años.
  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: {
      ultimaInspeccionVisualInterna: parsed.data.fechaRealizacion,
      fechaProximaInspeccionVisualInterna: addTenYears(parsed.data.fechaRealizacion),
      ...(parsed.data.numeroInspeccion
        ? { numeroUltimaInspeccionVisualInterna: parsed.data.numeroInspeccion }
        : {}),
    },
    create: {
      vehicleRecordId: vehicleId,
      ultimaInspeccionVisualInterna: parsed.data.fechaRealizacion,
      fechaProximaInspeccionVisualInterna: addTenYears(parsed.data.fechaRealizacion),
      numeroUltimaInspeccionVisualInterna: parsed.data.numeroInspeccion,
    },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Inspección visual interna registrada y ficha técnica actualizada." };
}

export async function deleteInternalVisualInspectionLog(logId: string) {
  await requireAdmin();

  const log = await prisma.internalVisualInspectionLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) return;

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("internalVisualInspectionLogId", logId);
  await prisma.internalVisualInspectionLog.delete({ where: { id: logId } });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
}
