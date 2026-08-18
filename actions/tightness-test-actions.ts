"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { saveDocumentFile, tightnessTestLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
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
}, z.date({ required_error: "La fecha de la próxima prueba es requerida", invalid_type_error: "Fecha inválida" }));

const createTightnessTestLogSchema = z.object({
  compania: optionalText(150),
  numeroPrueba: optionalText(100),
  responsable: optionalText(150),
  fechaUltimaPrueba: optionalDate,
  fechaRealizacion: requiredDate,
  fechaProximaPrueba: requiredProximaDate,
});

export async function createTightnessTestLog(
  vehicleId: string,
  stationTankTechnicalSheetId: string | null,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createTightnessTestLogSchema.safeParse({
    compania: formData.get("compania"),
    numeroPrueba: formData.get("numeroPrueba"),
    responsable: formData.get("responsable"),
    fechaUltimaPrueba: formData.get("fechaUltimaPrueba"),
    fechaRealizacion: formData.get("fechaRealizacion"),
    fechaProximaPrueba: formData.get("fechaProximaPrueba"),
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
  // ciclo de prueba de hermeticidad; se valida que el id en verdad sea un
  // tanque de este registro antes de escribir en él.
  let tank: { id: string } | null = null;
  if (stationTankTechnicalSheetId) {
    tank = await prisma.stationTankTechnicalSheet.findFirst({
      where: { id: stationTankTechnicalSheetId, vehicleRecordId: vehicleId },
      select: { id: true },
    });
    if (!tank) return { error: "El tanque no corresponde a este registro." };
  }

  const log = await prisma.tightnessTestLog.create({
    data: {
      vehicleRecordId: vehicleId,
      stationTankTechnicalSheetId: tank?.id ?? null,
      createdById: editor.userId,
      ...parsed.data,
    },
  });

  for (const file of files) {
    const { storedName } = await saveDocumentFile(tightnessTestLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        tightnessTestLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  // Al aceptar el registro, la ficha técnica refleja automáticamente la
  // prueba recién realizada como la "última prueba de hermeticidad" y la
  // fecha capturada como la "próxima" (la que dispara la alerta). Si es de
  // un tanque específico, se guarda en ESE tanque.
  if (tank) {
    await prisma.stationTankTechnicalSheet.update({
      where: { id: tank.id },
      data: {
        ultimaPruebaHermeticidad: parsed.data.fechaRealizacion,
        fechaProximaPruebaHermeticidad: parsed.data.fechaProximaPrueba,
        ...(parsed.data.numeroPrueba ? { numeroUltimaPruebaHermeticidad: parsed.data.numeroPrueba } : {}),
      },
    });
  } else {
    await prisma.vehicleTechnicalSheet.upsert({
      where: { vehicleRecordId: vehicleId },
      update: {
        ultimaPruebaHermeticidad: parsed.data.fechaRealizacion,
        fechaProximaPruebaHermeticidad: parsed.data.fechaProximaPrueba,
        ...(parsed.data.numeroPrueba ? { numeroUltimaPruebaHermeticidad: parsed.data.numeroPrueba } : {}),
      },
      create: {
        vehicleRecordId: vehicleId,
        ultimaPruebaHermeticidad: parsed.data.fechaRealizacion,
        fechaProximaPruebaHermeticidad: parsed.data.fechaProximaPrueba,
        numeroUltimaPruebaHermeticidad: parsed.data.numeroPrueba,
      },
    });
  }

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Prueba de hermeticidad registrada y ficha técnica actualizada." };
}

// Solo ADMIN puede corregir un registro ya guardado. No vuelve a sincronizar
// la ficha técnica (ver actions/ultrasound-actions.ts para el mismo patrón).
export async function updateTightnessTestLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireElevatedEditor();

  const parsed = createTightnessTestLogSchema.safeParse({
    compania: formData.get("compania"),
    numeroPrueba: formData.get("numeroPrueba"),
    responsable: formData.get("responsable"),
    fechaUltimaPrueba: formData.get("fechaUltimaPrueba"),
    fechaRealizacion: formData.get("fechaRealizacion"),
    fechaProximaPrueba: formData.get("fechaProximaPrueba"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.tightnessTestLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  await prisma.tightnessTestLog.update({ where: { id: logId }, data: parsed.data });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  return { success: "Registro actualizado." };
}

export async function deleteTightnessTestLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const log = await prisma.tightnessTestLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro ya no existe." };
  }

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Prueba de hermeticidad",
    resumen: log.vehicleRecord.numeroEconomico,
    citySlug: log.vehicleRecord.section.city.slug,
  });

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("tightnessTestLogId", logId);
  await prisma.tightnessTestLog.delete({ where: { id: logId } });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "Registro eliminado." };
}
