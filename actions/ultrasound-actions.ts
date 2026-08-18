"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { saveDocumentFile, ultrasoundLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
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
}, z.date({ required_error: "La fecha del próximo ultrasonido es requerida", invalid_type_error: "Fecha inválida" }));

// Al crear, la fecha próxima ya no se captura a mano: se calcula sola (ver
// más abajo, addFiveYears). Al corregir un registro ya guardado sí se puede
// ajustar manualmente (createUltrasoundLogSchema de abajo la sigue pidiendo).
const createUltrasoundLogSchema = z.object({
  compania: optionalText(150),
  numeroUltrasonido: optionalText(100),
  responsable: optionalText(150),
  fechaUltimoUltrasonido: optionalDate,
  fechaRealizacion: requiredDate,
});

const updateUltrasoundLogSchema = z.object({
  compania: optionalText(150),
  numeroUltrasonido: optionalText(100),
  responsable: optionalText(150),
  fechaUltimoUltrasonido: optionalDate,
  fechaRealizacion: requiredDate,
  fechaProximoUltrasonido: requiredProximaDate,
});

// Medición ultrasónica de espesores: la primera se calcula a los 10 años de
// la fecha de fabricación del tanque (ver upsertTechnicalSheet en
// actions/vehicle-actions.ts); cada medición posterior recorre el ciclo
// otros 5 años a partir de la fecha en que se realizó (más corto que el
// resto de las pruebas del tanque, que son cada 10).
function addFiveYears(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + 5, date.getUTCMonth(), date.getUTCDate()));
}

export async function createUltrasoundLog(
  vehicleId: string,
  stationTankTechnicalSheetId: string | null,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createUltrasoundLogSchema.safeParse({
    compania: formData.get("compania"),
    numeroUltrasonido: formData.get("numeroUltrasonido"),
    responsable: formData.get("responsable"),
    fechaUltimoUltrasonido: formData.get("fechaUltimoUltrasonido"),
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

  // El rol dice si puede editar, no si puede editar ESTO: vehicleId llega
  // del navegador y esta acción es un endpoint llamable directo, así que sin
  // esto un USUARIO de una ciudad podía escribir en la bitácora de otra
  // (ver lib/access.ts).
  await assertCityAccessById(editor, vehicle.section.cityId);

  // Cuando la estación/planta tiene varios tanques, cada uno lleva su propio
  // ciclo de ultrasonido (ver StationTankTechnicalSheet); el id llega del
  // navegador igual que vehicleId, así que se valida que en verdad sea un
  // tanque de este registro antes de escribir en él.
  let tank: { id: string } | null = null;
  if (stationTankTechnicalSheetId) {
    tank = await prisma.stationTankTechnicalSheet.findFirst({
      where: { id: stationTankTechnicalSheetId, vehicleRecordId: vehicleId },
      select: { id: true },
    });
    if (!tank) return { error: "El tanque no corresponde a este registro." };
  }

  const fechaProximoUltrasonido = addFiveYears(parsed.data.fechaRealizacion);

  const log = await prisma.ultrasoundLog.create({
    data: {
      vehicleRecordId: vehicleId,
      stationTankTechnicalSheetId: tank?.id ?? null,
      createdById: editor.userId,
      ...parsed.data,
      fechaProximoUltrasonido,
    },
  });

  for (const file of files) {
    const { storedName } = await saveDocumentFile(ultrasoundLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        ultrasoundLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  // Al aceptar el registro, la ficha técnica refleja automáticamente el
  // ultrasonido recién realizado como el "último ultrasonido" y la fecha que
  // se acaba de capturar como el "próximo ultrasonido" (la que dispara la
  // alerta amarilla/roja en VehicleTable y el panel del dashboard). Si el
  // registro es de un tanque específico (estación/planta con varios
  // tanques), esto se guarda en ESE tanque, no en la ficha compartida.
  if (tank) {
    await prisma.stationTankTechnicalSheet.update({
      where: { id: tank.id },
      data: {
        ultimoUltrasonido: parsed.data.fechaRealizacion,
        fechaProximoUltrasonido,
        ...(parsed.data.numeroUltrasonido
          ? { numeroUltimoUltrasonido: parsed.data.numeroUltrasonido }
          : {}),
      },
    });
  } else {
    await prisma.vehicleTechnicalSheet.upsert({
      where: { vehicleRecordId: vehicleId },
      update: {
        ultimoUltrasonido: parsed.data.fechaRealizacion,
        fechaProximoUltrasonido,
        ...(parsed.data.numeroUltrasonido ? { numeroUltimoUltrasonido: parsed.data.numeroUltrasonido } : {}),
      },
      create: {
        vehicleRecordId: vehicleId,
        ultimoUltrasonido: parsed.data.fechaRealizacion,
        fechaProximoUltrasonido,
        numeroUltimoUltrasonido: parsed.data.numeroUltrasonido,
      },
    });
  }

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Ultrasonido registrado y ficha técnica actualizada." };
}

// Solo ADMIN puede corregir un registro ya guardado. A diferencia de crear
// uno nuevo, esto no vuelve a sincronizar la ficha técnica (esa ya quedó
// actualizada al aceptar el registro original) — solo corrige el dato
// capturado, evitando efectos secundarios sorpresa al editar uno viejo.
export async function updateUltrasoundLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireElevatedEditor();

  const parsed = updateUltrasoundLogSchema.safeParse({
    compania: formData.get("compania"),
    numeroUltrasonido: formData.get("numeroUltrasonido"),
    responsable: formData.get("responsable"),
    fechaUltimoUltrasonido: formData.get("fechaUltimoUltrasonido"),
    fechaRealizacion: formData.get("fechaRealizacion"),
    fechaProximoUltrasonido: formData.get("fechaProximoUltrasonido"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.ultrasoundLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  await prisma.ultrasoundLog.update({ where: { id: logId }, data: parsed.data });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  return { success: "Registro actualizado." };
}

export async function deleteUltrasoundLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const log = await prisma.ultrasoundLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro ya no existe." };
  }

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Registro de ultrasonido",
    resumen: `${log.vehicleRecord.numeroEconomico}${log.numeroUltrasonido ? ` — No. ${log.numeroUltrasonido}` : ""}`,
    citySlug: log.vehicleRecord.section.city.slug,
  });

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("ultrasoundLogId", logId);
  await prisma.ultrasoundLog.delete({ where: { id: logId } });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "Registro eliminado." };
}
