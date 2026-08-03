"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { getSectionChain, sectionBasePath } from "@/lib/section-path";
import { maintenanceStatusSchema } from "@/lib/vehicle-enums";
import { saveDocumentFile, maintenanceLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
import type { ActionState } from "./user-actions";

const requiredText = (label: string, max: number) =>
  z.preprocess((value) => String(value ?? "").trim(), z.string().min(1, `${label} es requerido`).max(max));

// null (no undefined) para que un campo vaciado en el formulario también se
// borre al actualizar: Prisma ignora las claves undefined en un update.
const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const optionalInt = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? Number(text) : null;
}, z.number().int().min(0).nullable());

const createLogSchema = z.object({
  tipoMantenimiento: requiredText("El tipo de mantenimiento", 100),
  tipoServicio: requiredText("El tipo de servicio", 100),
  pieza: optionalText(100),
  cantidad: optionalText(50),
  unidad: optionalText(50),
  descripcion: optionalText(1000),
  observacion: optionalText(1000),
  fecha: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? new Date(text) : undefined;
  }, z.date({ required_error: "La fecha es requerida", invalid_type_error: "Fecha inválida" })),
  kilometraje: optionalInt,
  nombreOperador: optionalText(150),
  auxiliarTecnico: optionalText(150),
  responsableTrabajoMecanico: optionalText(150),
  estatus: maintenanceStatusSchema.default("SIN_ATENCION"),
});

// Suma 6 meses a una fecha (UTC, sin desfase de zona horaria) — mismo patrón
// que addTenYears en actions/vehicle-actions.ts.
function addSixMonths(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 6, date.getUTCDate()));
}

async function revalidateVehicleAndCityFeed(vehicleId: string) {
  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) return;

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);

  const chain = await getSectionChain(vehicle.sectionId);
  const rootSlug = chain[0]?.slug;
  if (rootSlug === "bitacoras-de-unidades") {
    revalidatePath(sectionBasePath(vehicle.section.city.slug, [chain[0]]));
  } else {
    const bitacoraRoot = await prisma.section.findFirst({
      where: { cityId: vehicle.section.cityId, parentId: null, slug: "bitacoras-de-unidades" },
    });
    if (bitacoraRoot) {
      revalidatePath(sectionBasePath(vehicle.section.city.slug, [bitacoraRoot]));
    }
  }
}

export async function createMaintenanceLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createLogSchema.safeParse({
    tipoMantenimiento: formData.get("tipoMantenimiento"),
    tipoServicio: formData.get("tipoServicio"),
    pieza: formData.get("pieza"),
    cantidad: formData.get("cantidad"),
    unidad: formData.get("unidad"),
    descripcion: formData.get("descripcion"),
    observacion: formData.get("observacion"),
    fecha: formData.get("fecha"),
    kilometraje: formData.get("kilometraje"),
    nombreOperador: formData.get("nombreOperador"),
    auxiliarTecnico: formData.get("auxiliarTecnico"),
    responsableTrabajoMecanico: formData.get("responsableTrabajoMecanico"),
    estatus: formData.get("estatus"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const files = readOptionalPdfFiles(formData);
  if (!Array.isArray(files)) return files;

  const vehicle = await prisma.vehicleRecord.findUnique({ where: { id: vehicleId } });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  const log = await prisma.maintenanceLog.create({
    data: {
      vehicleRecordId: vehicleId,
      createdById: editor.userId,
      ...parsed.data,
    },
  });

  for (const file of files) {
    const { storedName } = await saveDocumentFile(maintenanceLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        maintenanceLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  // Si se capturó kilometraje, este mantenimiento cuenta como el punto de
  // referencia para el siguiente preventivo: 10,000 km o 6 meses después,
  // lo que se cumpla primero (ver lib/maintenance-alerts.ts). Cualquier
  // mantenimiento con kilometraje reinicia el conteo, no solo el preventivo.
  if (parsed.data.kilometraje !== null) {
    await prisma.vehicleTechnicalSheet.upsert({
      where: { vehicleRecordId: vehicleId },
      update: {
        kilometrajeUltimoMantenimiento: parsed.data.kilometraje,
        fechaUltimoMantenimiento: parsed.data.fecha,
        kilometrajeProximoMantenimiento: parsed.data.kilometraje + 10000,
        fechaProximoMantenimiento: addSixMonths(parsed.data.fecha),
      },
      create: {
        vehicleRecordId: vehicleId,
        kilometrajeUltimoMantenimiento: parsed.data.kilometraje,
        fechaUltimoMantenimiento: parsed.data.fecha,
        kilometrajeProximoMantenimiento: parsed.data.kilometraje + 10000,
        fechaProximoMantenimiento: addSixMonths(parsed.data.fecha),
      },
    });
  }

  await revalidateVehicleAndCityFeed(vehicleId);
  return { success: "Mantenimiento registrado." };
}

const updateLogSchema = z.object({
  descripcion: optionalText(1000),
  estatus: maintenanceStatusSchema,
});

export async function updateMaintenanceLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireEditor();

  const parsed = updateLogSchema.safeParse({
    descripcion: formData.get("descripcion"),
    estatus: formData.get("estatus"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.maintenanceLog.findUnique({ where: { id: logId } });
  if (!log) {
    return { error: "El registro no existe." };
  }

  await prisma.maintenanceLog.update({ where: { id: logId }, data: parsed.data });

  await revalidateVehicleAndCityFeed(log.vehicleRecordId);
  return { success: "Actualizado." };
}

export async function deleteMaintenanceLog(logId: string) {
  await requireAdmin();

  const log = await prisma.maintenanceLog.findUnique({ where: { id: logId } });
  if (!log) return;

  await prisma.maintenanceLog.delete({ where: { id: logId } });
  await revalidateVehicleAndCityFeed(log.vehicleRecordId);
}
