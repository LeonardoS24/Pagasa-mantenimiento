"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor, checkSessionUserExists } from "@/lib/auth";
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
  fechaRealizacion: requiredDate("La fecha de realización es requerida"),
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
    fechaRealizacion: formData.get("fechaRealizacion"),
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

  // Al aceptar el cambio, la ficha técnica refleja automáticamente el nuevo
  // extintor. fechaCalidadMalaExtintor marca la primera vez que se detectó
  // "MALA" (ancla la alerta amarilla/roja); se conserva si ya venía en MALA
  // y se limpia si la nueva calidad no es MALA.
  const fechaCalidadMalaExtintor =
    parsed.data.calidad === "MALA"
      ? vehicle.technicalSheet?.calidadExtintor === "MALA"
        ? vehicle.technicalSheet.fechaCalidadMalaExtintor
        : new Date()
      : null;

  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: {
      fechaInstalacionExtintor: parsed.data.fechaInstalacion,
      fechaVencimientoExtintor: parsed.data.fechaVencimiento,
      calidadExtintor: parsed.data.calidad,
      fechaCalidadMalaExtintor,
    },
    create: {
      vehicleRecordId: vehicleId,
      fechaInstalacionExtintor: parsed.data.fechaInstalacion,
      fechaVencimientoExtintor: parsed.data.fechaVencimiento,
      calidadExtintor: parsed.data.calidad,
      fechaCalidadMalaExtintor,
    },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  revalidatePath("/dashboard");
  return { success: "Cambio de extintor registrado y ficha técnica actualizada." };
}

export async function deleteExtinguisherChangeLog(logId: string) {
  await requireAdmin();

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
