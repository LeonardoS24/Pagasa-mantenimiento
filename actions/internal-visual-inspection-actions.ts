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

// La primera revisión vence a los 10 años de la fecha de fabricación del
// tanque (ver addTenYears/fechaProximaInspeccionVisualInterna en
// actions/vehicle-actions.ts, calculado una sola vez al dar de alta el
// tanque). A partir de ahí, cada revisión ya realizada (registrada aquí)
// vuelve a agendar la siguiente 5 años después, no 10 — aplica tanto a
// Planta como a Estaciones de carburación (mismo campo, mismo mecanismo).
function addFiveYears(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + 5, date.getUTCMonth(), date.getUTCDate()));
}

export async function createInternalVisualInspectionLog(
  vehicleId: string,
  stationTankTechnicalSheetId: string | null,
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

  // El rol dice si puede editar, no si puede editar ESTO: vehicleId llega
  // del navegador y esta acción es un endpoint llamable directo, así que sin
  // esto un USUARIO de una ciudad podía escribir en la bitácora de otra
  // (ver lib/access.ts).
  await assertCityAccessById(editor, vehicle.section.cityId);

  // Cuando la estación/planta tiene varios tanques, cada uno lleva su propio
  // ciclo de inspección visual interna; se valida que el id en verdad sea un
  // tanque de este registro antes de escribir en él.
  let tank: { id: string } | null = null;
  if (stationTankTechnicalSheetId) {
    tank = await prisma.stationTankTechnicalSheet.findFirst({
      where: { id: stationTankTechnicalSheetId, vehicleRecordId: vehicleId },
      select: { id: true },
    });
    if (!tank) return { error: "El tanque no corresponde a este registro." };
  }

  const log = await prisma.internalVisualInspectionLog.create({
    data: {
      vehicleRecordId: vehicleId,
      stationTankTechnicalSheetId: tank?.id ?? null,
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
  // recalcula automáticamente la fecha próxima: la primera revisión vence a
  // los 10 años de fabricación, pero de ahí en adelante cada revisión ya
  // realizada agenda la siguiente 5 años después (ver addFiveYears arriba).
  // Si el registro es de un tanque específico, se guarda en ESE tanque.
  const fechaProximaInspeccionVisualInterna = addFiveYears(parsed.data.fechaRealizacion);
  if (tank) {
    await prisma.stationTankTechnicalSheet.update({
      where: { id: tank.id },
      data: {
        ultimaInspeccionVisualInterna: parsed.data.fechaRealizacion,
        fechaProximaInspeccionVisualInterna,
        ...(parsed.data.numeroInspeccion
          ? { numeroUltimaInspeccionVisualInterna: parsed.data.numeroInspeccion }
          : {}),
      },
    });
  } else {
    await prisma.vehicleTechnicalSheet.upsert({
      where: { vehicleRecordId: vehicleId },
      update: {
        ultimaInspeccionVisualInterna: parsed.data.fechaRealizacion,
        fechaProximaInspeccionVisualInterna,
        ...(parsed.data.numeroInspeccion
          ? { numeroUltimaInspeccionVisualInterna: parsed.data.numeroInspeccion }
          : {}),
      },
      create: {
        vehicleRecordId: vehicleId,
        ultimaInspeccionVisualInterna: parsed.data.fechaRealizacion,
        fechaProximaInspeccionVisualInterna,
        numeroUltimaInspeccionVisualInterna: parsed.data.numeroInspeccion,
      },
    });
  }

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Inspección visual interna registrada y ficha técnica actualizada." };
}

// Solo ADMIN puede corregir un registro ya guardado. No vuelve a sincronizar
// la ficha técnica ni recalcula la fecha próxima (ver
// actions/ultrasound-actions.ts para el mismo patrón).
export async function updateInternalVisualInspectionLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireElevatedEditor();

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

  const log = await prisma.internalVisualInspectionLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  await prisma.internalVisualInspectionLog.update({ where: { id: logId }, data: parsed.data });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  return { success: "Registro actualizado." };
}

export async function deleteInternalVisualInspectionLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const log = await prisma.internalVisualInspectionLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro ya no existe." };
  }

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Inspección visual interna",
    resumen: log.vehicleRecord.numeroEconomico,
    citySlug: log.vehicleRecord.section.city.slug,
  });

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("internalVisualInspectionLogId", logId);
  await prisma.internalVisualInspectionLog.delete({ where: { id: logId } });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "Registro eliminado." };
}
