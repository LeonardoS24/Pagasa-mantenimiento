"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { saveDocumentFile, valveChangeLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
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

const createValveChangeLogSchema = z.object({
  responsable: optionalText(150),
  fechaInstalacion: requiredDate("La fecha de instalación es requerida"),
  fechaFabricacionValvulaLlenado: requiredDate(
    "La fecha de fabricación de la válvula de llenado es requerida"
  ),
  fechaFabricacionValvulaServicio: requiredDate(
    "La fecha de fabricación de la válvula de servicio es requerida"
  ),
  fechaFabricacionValvulaMaximoLlenado: requiredDate(
    "La fecha de fabricación de la válvula de máximo llenado es requerida"
  ),
  fechaFabricacionValvulaAlivio: requiredDate(
    "La fecha de fabricación de la válvula de alivio es requerida"
  ),
});

export async function createValveChangeLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createValveChangeLogSchema.safeParse({
    responsable: formData.get("responsable"),
    fechaInstalacion: formData.get("fechaInstalacion"),
    fechaFabricacionValvulaLlenado: formData.get("fechaFabricacionValvulaLlenado"),
    fechaFabricacionValvulaServicio: formData.get("fechaFabricacionValvulaServicio"),
    fechaFabricacionValvulaMaximoLlenado: formData.get("fechaFabricacionValvulaMaximoLlenado"),
    fechaFabricacionValvulaAlivio: formData.get("fechaFabricacionValvulaAlivio"),
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

  const log = await prisma.valveChangeLog.create({
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
    await vincularPiezaARegistro(piezaId, "VALVULAS", log.id, vehicleId);
  }

  for (const file of files) {
    const { storedName } = await saveDocumentFile(valveChangeLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        valveChangeLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  // Al aceptar el cambio, la ficha técnica refleja automáticamente las 4
  // fechas de fabricación y la fecha general de instalación del nuevo juego
  // de válvulas (mismo patrón que extintor: siempre se sobrescribe con lo
  // más reciente).
  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: {
      fechaInstalacionValvulas: parsed.data.fechaInstalacion,
      fechaFabricacionValvulaLlenado: parsed.data.fechaFabricacionValvulaLlenado,
      fechaFabricacionValvulaServicio: parsed.data.fechaFabricacionValvulaServicio,
      fechaFabricacionValvulaMaximoLlenado: parsed.data.fechaFabricacionValvulaMaximoLlenado,
      fechaFabricacionValvulaAlivio: parsed.data.fechaFabricacionValvulaAlivio,
    },
    create: {
      vehicleRecordId: vehicleId,
      fechaInstalacionValvulas: parsed.data.fechaInstalacion,
      fechaFabricacionValvulaLlenado: parsed.data.fechaFabricacionValvulaLlenado,
      fechaFabricacionValvulaServicio: parsed.data.fechaFabricacionValvulaServicio,
      fechaFabricacionValvulaMaximoLlenado: parsed.data.fechaFabricacionValvulaMaximoLlenado,
      fechaFabricacionValvulaAlivio: parsed.data.fechaFabricacionValvulaAlivio,
    },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  revalidatePath("/dashboard");
  return { success: "Cambio de válvulas registrado y ficha técnica actualizada." };
}

export async function deleteValveChangeLog(logId: string) {
  await requireAdmin();

  const log = await prisma.valveChangeLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) return;

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("valveChangeLogId", logId);
  await prisma.valveChangeLog.delete({ where: { id: logId } });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  revalidatePath("/dashboard");
}
