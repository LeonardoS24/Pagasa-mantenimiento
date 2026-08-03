"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor, checkSessionUserExists } from "@/lib/auth";
import {
  saveDocumentFile,
  valveCorrectiveMaintenanceLogOwnerKey,
  readOptionalPdfFiles,
} from "@/lib/documents";
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

const createValveCorrectiveMaintenanceLogSchema = z.object({
  valvula: z.enum(["LLENADO", "SERVICIO", "MAXIMO_LLENADO", "ALIVIO", "GENERAL"], {
    required_error: "Selecciona la válvula afectada",
  }),
  descripcion: z.preprocess((value) => String(value ?? "").trim(), z.string().min(1, "La descripción es requerida").max(2000)),
  responsable: optionalText(150),
  fecha: requiredDate("La fecha es requerida"),
});

export async function createValveCorrectiveMaintenanceLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createValveCorrectiveMaintenanceLogSchema.safeParse({
    valvula: formData.get("valvula"),
    descripcion: formData.get("descripcion"),
    responsable: formData.get("responsable"),
    fecha: formData.get("fecha"),
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

  const log = await prisma.valveCorrectiveMaintenanceLog.create({
    data: {
      vehicleRecordId: vehicleId,
      createdById: editor.userId,
      ...parsed.data,
    },
  });

  for (const file of files) {
    const { storedName } = await saveDocumentFile(
      valveCorrectiveMaintenanceLogOwnerKey(log.id),
      file
    );
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        valveCorrectiveMaintenanceLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Mantenimiento correctivo registrado." };
}

export async function deleteValveCorrectiveMaintenanceLog(logId: string) {
  await requireAdmin();

  const log = await prisma.valveCorrectiveMaintenanceLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) return;

  await prisma.valveCorrectiveMaintenanceLog.delete({ where: { id: logId } });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
}
