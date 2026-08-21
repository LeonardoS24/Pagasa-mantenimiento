"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import {
  saveDocumentFile,
  valveCorrectiveMaintenanceLogOwnerKey,
  readOptionalPdfFiles,
} from "@/lib/documents";
import { vincularPiezaARegistro } from "./inventory-actions";
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

const createValveCorrectiveMaintenanceLogSchema = z.object({
  valvula: z.enum(
    [
      "LLENADO",
      "NO_RETROCESO",
      "BYPASS",
      "RETORNO_VAPORES",
      "SERVICIO",
      "MAXIMO_LLENADO",
      "MAXIMO_LLENADO_85",
      "ALIVIO",
      "DESCARGA_EMERGENCIA",
      "GENERAL",
    ],
    { required_error: "Selecciona la válvula afectada" }
  ),
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

  // El rol dice si puede editar, no si puede editar ESTO: vehicleId llega
  // del navegador y esta acción es un endpoint llamable directo, así que sin
  // esto un USUARIO de una ciudad podía escribir en la bitácora de otra
  // (ver lib/access.ts).
  await assertCityAccessById(editor, vehicle.section.cityId);

  const log = await prisma.valveCorrectiveMaintenanceLog.create({
    data: {
      vehicleRecordId: vehicleId,
      createdById: editor.userId,
      ...parsed.data,
    },
  });

  // Viene del flujo de Inventarios: la pieza ya quedó marcada "Utilizada" en
  // esta unidad y solo faltaba el registro al que amarrarla.
  const piezaId = String(formData.get("vincularPieza") ?? "").trim();
  if (piezaId) {
    await vincularPiezaARegistro(piezaId, "VALVULAS_CORRECTIVO", log.id, vehicleId);
  }

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

// Solo ADMIN puede corregir un registro ya guardado.
export async function updateValveCorrectiveMaintenanceLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireElevatedEditor();

  const parsed = createValveCorrectiveMaintenanceLogSchema.safeParse({
    valvula: formData.get("valvula"),
    descripcion: formData.get("descripcion"),
    responsable: formData.get("responsable"),
    fecha: formData.get("fecha"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.valveCorrectiveMaintenanceLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }
  // Ver lib/access.ts: el rol dice si puede editar, no si puede editar ESTO.
  await assertCityAccessById(editor, log.vehicleRecord.section.cityId);

  await prisma.valveCorrectiveMaintenanceLog.update({ where: { id: logId }, data: parsed.data });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  return { success: "Registro actualizado." };
}

export async function deleteValveCorrectiveMaintenanceLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const log = await prisma.valveCorrectiveMaintenanceLog.findUnique({
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
    entidad: "Mantenimiento correctivo de válvulas",
    resumen: log.vehicleRecord.numeroEconomico,
    citySlug: log.vehicleRecord.section.city.slug,
  });

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("valveCorrectiveMaintenanceLogId", logId);
  await prisma.valveCorrectiveMaintenanceLog.delete({ where: { id: logId } });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  return { success: "Registro eliminado." };
}
