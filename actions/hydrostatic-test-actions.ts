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

// Igual que la inspección visual interna (ver
// actions/internal-visual-inspection-actions.ts): la primera prueba vence a
// los 10 años de fabricación (calculado una sola vez al dar de alta el
// tanque, ver actions/vehicle-actions.ts), pero cada prueba ya realizada
// agenda la siguiente 5 años después — aplica tanto a Planta como a
// Estaciones de carburación.
function addFiveYears(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + 5, date.getUTCMonth(), date.getUTCDate()));
}

export async function createHydrostaticTestLog(
  vehicleId: string,
  stationTankTechnicalSheetId: string | null,
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

  // El rol dice si puede editar, no si puede editar ESTO: vehicleId llega
  // del navegador y esta acción es un endpoint llamable directo, así que sin
  // esto un USUARIO de una ciudad podía escribir en la bitácora de otra
  // (ver lib/access.ts).
  await assertCityAccessById(editor, vehicle.section.cityId);

  // Cuando la estación/planta tiene varios tanques, cada uno lleva su propio
  // ciclo de prueba hidrostática; se valida que el id en verdad sea un
  // tanque de este registro antes de escribir en él.
  let tank: { id: string } | null = null;
  if (stationTankTechnicalSheetId) {
    tank = await prisma.stationTankTechnicalSheet.findFirst({
      where: { id: stationTankTechnicalSheetId, vehicleRecordId: vehicleId },
      select: { id: true },
    });
    if (!tank) return { error: "El tanque no corresponde a este registro." };
  }

  const log = await prisma.hydrostaticTestLog.create({
    data: {
      vehicleRecordId: vehicleId,
      stationTankTechnicalSheetId: tank?.id ?? null,
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

  // La primera prueba vence a los 10 años de fabricación; de ahí en
  // adelante, cada prueba ya realizada agenda la siguiente 5 años después
  // (ver addFiveYears arriba). Si es de un tanque específico, se guarda en
  // ESE tanque.
  const fechaProximaPruebaHidrostatica = addFiveYears(parsed.data.fechaRealizacion);
  if (tank) {
    await prisma.stationTankTechnicalSheet.update({
      where: { id: tank.id },
      data: {
        ultimaPruebaHidrostatica: parsed.data.fechaRealizacion,
        fechaProximaPruebaHidrostatica,
        ...(parsed.data.numeroPrueba ? { numeroUltimaPruebaHidrostatica: parsed.data.numeroPrueba } : {}),
      },
    });
  } else {
    await prisma.vehicleTechnicalSheet.upsert({
      where: { vehicleRecordId: vehicleId },
      update: {
        ultimaPruebaHidrostatica: parsed.data.fechaRealizacion,
        fechaProximaPruebaHidrostatica,
        ...(parsed.data.numeroPrueba ? { numeroUltimaPruebaHidrostatica: parsed.data.numeroPrueba } : {}),
      },
      create: {
        vehicleRecordId: vehicleId,
        ultimaPruebaHidrostatica: parsed.data.fechaRealizacion,
        fechaProximaPruebaHidrostatica,
        numeroUltimaPruebaHidrostatica: parsed.data.numeroPrueba,
      },
    });
  }

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Prueba hidrostática registrada y ficha técnica actualizada." };
}

// Solo ADMIN puede corregir un registro ya guardado. No vuelve a sincronizar
// la ficha técnica ni recalcula la fecha próxima (ver
// actions/ultrasound-actions.ts para el mismo patrón).
export async function updateHydrostaticTestLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireElevatedEditor();

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

  const log = await prisma.hydrostaticTestLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  await prisma.hydrostaticTestLog.update({ where: { id: logId }, data: parsed.data });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  return { success: "Registro actualizado." };
}

export async function deleteHydrostaticTestLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const log = await prisma.hydrostaticTestLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro ya no existe." };
  }

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Prueba hidrostática",
    resumen: log.vehicleRecord.numeroEconomico,
    citySlug: log.vehicleRecord.section.city.slug,
  });

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("hydrostaticTestLogId", logId);
  await prisma.hydrostaticTestLog.delete({ where: { id: logId } });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "Registro eliminado." };
}
