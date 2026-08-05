"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor, checkSessionUserExists } from "@/lib/auth";
import {
  saveDocumentFile,
  hydrostaticTestLogOwnerKey,
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

const createHydrostaticTestLogSchema = z.object({
  compania: optionalText(150),
  numeroPrueba: optionalText(100),
  responsable: optionalText(150),
  fechaUltimaPrueba: optionalDate,
  fechaRealizacion: requiredDate,
});

function addTenYears(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + 10, date.getUTCMonth(), date.getUTCDate()));
}

export async function createHydrostaticTestLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createHydrostaticTestLogSchema.safeParse({
    compania: formData.get("compania"),
    numeroPrueba: formData.get("numeroPrueba"),
    responsable: formData.get("responsable"),
    fechaUltimaPrueba: formData.get("fechaUltimaPrueba"),
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

  const log = await prisma.hydrostaticTestLog.create({
    data: {
      vehicleRecordId: vehicleId,
      createdById: editor.userId,
      ...parsed.data,
    },
  });

  for (const file of files) {
    const { storedName } = await saveDocumentFile(hydrostaticTestLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        hydrostaticTestLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  // Igual que la inspección visual interna: vence cada 10 años, así que la
  // fecha próxima se recalcula sola como fechaRealizacion + 10 años.
  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: {
      ultimaPruebaHidrostatica: parsed.data.fechaRealizacion,
      fechaProximaPruebaHidrostatica: addTenYears(parsed.data.fechaRealizacion),
      ...(parsed.data.numeroPrueba ? { numeroUltimaPruebaHidrostatica: parsed.data.numeroPrueba } : {}),
    },
    create: {
      vehicleRecordId: vehicleId,
      ultimaPruebaHidrostatica: parsed.data.fechaRealizacion,
      fechaProximaPruebaHidrostatica: addTenYears(parsed.data.fechaRealizacion),
      numeroUltimaPruebaHidrostatica: parsed.data.numeroPrueba,
    },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Prueba hidrostática registrada y ficha técnica actualizada." };
}

export async function deleteHydrostaticTestLog(logId: string) {
  await requireAdmin();

  const log = await prisma.hydrostaticTestLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) return;

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("hydrostaticTestLogId", logId);
  await prisma.hydrostaticTestLog.delete({ where: { id: logId } });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
}
