"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, requireUser, checkSessionUserExists } from "@/lib/auth";
import { getSectionChain, sectionBasePath } from "@/lib/section-path";
import { equipmentLogTipoSchema, criticidadEquipoSchema } from "@/lib/equipo-enums";
import { saveDocumentFile, equipmentLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
import { deleteLogDocumentFiles } from "@/lib/document-cleanup";
import { assertCanViewCity } from "./record-drilldown-actions";
import { getEquipmentLogsForType, type EquipmentMaintenanceTypeLogEntry } from "@/lib/equipment-maintenance-type-stats";
import type { MonthRange } from "@/lib/piece-maintenance-stats";
import type { ActionState } from "./user-actions";

const requiredText = (label: string, max: number) =>
  z.preprocess((value) => String(value ?? "").trim(), z.string().min(1, `${label} es requerido`).max(max));

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const requiredDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : undefined;
}, z.date({ required_error: "La fecha es requerida", invalid_type_error: "Fecha inválida" }));

const createLogSchema = z.object({
  tipoMantenimiento: equipmentLogTipoSchema,
  descripcion: requiredText("La descripción", 1000),
  responsable: optionalText(150),
  fecha: requiredDate,
  observacion: optionalText(1000),
  criticidad: criticidadEquipoSchema,
});

// El registro con la fecha más cercana a hoy manda (igual que
// recalcularFichaTecnicaMantenimiento en actions/maintenance-actions.ts):
// así una edición o un borrado de un registro viejo no deja a Equipo.criticidad
// pegada a lo último que se guardó si ya no es lo más vigente.
function masCercanoAHoyPorFecha<T extends { fecha: Date }>(logs: T[]): T | null {
  if (logs.length === 0) return null;
  const hoy = Date.now();
  return logs.reduce((mejor, actual) =>
    Math.abs(hoy - actual.fecha.getTime()) < Math.abs(hoy - mejor.fecha.getTime()) ? actual : mejor
  );
}

async function recalcularCriticidadEquipo(equipoId: string): Promise<void> {
  const logs = await prisma.equipmentLog.findMany({
    where: { equipoId, criticidad: { not: null } },
    select: { fecha: true, criticidad: true },
  });
  const masReciente = masCercanoAHoyPorFecha(logs);
  await prisma.equipo.update({
    where: { id: equipoId },
    data: { criticidad: masReciente?.criticidad ?? null },
  });
}

async function revalidateEquipoAndCityFeed(equipoId: string) {
  const equipo = await prisma.equipo.findUnique({
    where: { id: equipoId },
    include: { section: { include: { city: true } } },
  });
  if (!equipo) return;

  revalidatePath(`/ciudades/${equipo.section.city.slug}/equipo/${equipoId}`);

  const chain = await getSectionChain(equipo.sectionId);
  const rootSlug = chain[0]?.slug;
  if (rootSlug === "bitacora-de-equipos") {
    revalidatePath(sectionBasePath(equipo.section.city.slug, [chain[0]]));
  } else {
    const bitacoraRoot = await prisma.section.findFirst({
      where: { cityId: equipo.section.cityId, parentId: null, slug: "bitacora-de-equipos" },
    });
    if (bitacoraRoot) {
      revalidatePath(sectionBasePath(equipo.section.city.slug, [bitacoraRoot]));
    }
  }
  revalidatePath(sectionBasePath(equipo.section.city.slug, [equipo.section]));
}

export async function createEquipmentLog(
  equipoId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createLogSchema.safeParse({
    tipoMantenimiento: formData.get("tipoMantenimiento"),
    descripcion: formData.get("descripcion"),
    responsable: formData.get("responsable"),
    fecha: formData.get("fecha"),
    observacion: formData.get("observacion"),
    criticidad: formData.get("criticidad"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const files = readOptionalPdfFiles(formData);
  if (!Array.isArray(files)) return files;

  const equipo = await prisma.equipo.findUnique({
    where: { id: equipoId },
    include: { section: { include: { city: true } } },
  });
  if (!equipo) {
    return { error: "El equipo no existe." };
  }

  const log = await prisma.equipmentLog.create({
    data: { equipoId, createdById: editor.userId, ...parsed.data },
  });
  await recalcularCriticidadEquipo(equipoId);

  for (const file of files) {
    const { storedName } = await saveDocumentFile(equipmentLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: equipo.sectionId,
        equipmentLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  // "Cambio": el equipo se reemplaza por uno nuevo. Se da de baja el actual
  // (se conserva como historial, igual que una unidad) y se crea uno nuevo
  // del mismo tipo en la misma sección, con la ficha técnica en blanco para
  // llenarla de inmediato — no tendría sentido copiar los datos del equipo
  // que se acaba de reemplazar.
  if (parsed.data.tipoMantenimiento === "Cambio") {
    await prisma.equipo.update({
      where: { id: equipoId },
      data: { activo: false, fechaBaja: parsed.data.fecha },
    });

    const maxOrder = await prisma.equipo.aggregate({
      where: { sectionId: equipo.sectionId },
      _max: { order: true },
    });
    const nuevoEquipo = await prisma.equipo.create({
      data: {
        sectionId: equipo.sectionId,
        order: (maxOrder._max.order ?? -1) + 1,
        tipoEquipo: equipo.tipoEquipo,
        nombre: equipo.nombre,
      },
    });

    await revalidateEquipoAndCityFeed(equipoId);
    revalidatePath(sectionBasePath(equipo.section.city.slug, [equipo.section]));
    redirect(`/ciudades/${equipo.section.city.slug}/equipo/${nuevoEquipo.id}`);
  }

  await revalidateEquipoAndCityFeed(equipoId);
  return { success: "Registro de bitácora agregado." };
}

const updateLogSchema = z.object({
  tipoMantenimiento: equipmentLogTipoSchema,
  descripcion: requiredText("La descripción", 1000),
  responsable: optionalText(150),
  fecha: requiredDate,
  observacion: optionalText(1000),
  criticidad: criticidadEquipoSchema,
});

// Solo ADMIN puede corregir un registro de bitácora ya guardado (fecha,
// descripción, etc. capturados con un error). No cambia el mecanismo de
// "Cambio": editar un registro existente nunca vuelve a dar de baja ni crea
// otro equipo, eso solo pasa al crear uno nuevo.
export async function updateEquipmentLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireElevatedEditor();

  const parsed = updateLogSchema.safeParse({
    tipoMantenimiento: formData.get("tipoMantenimiento"),
    descripcion: formData.get("descripcion"),
    responsable: formData.get("responsable"),
    fecha: formData.get("fecha"),
    observacion: formData.get("observacion"),
    criticidad: formData.get("criticidad"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.equipmentLog.findUnique({ where: { id: logId } });
  if (!log) {
    return { error: "El registro no existe." };
  }

  await prisma.equipmentLog.update({ where: { id: logId }, data: parsed.data });
  await recalcularCriticidadEquipo(log.equipoId);
  await revalidateEquipoAndCityFeed(log.equipoId);
  return { success: "Registro actualizado." };
}

export async function deleteEquipmentLog(logId: string) {
  await requireElevatedEditor();

  const log = await prisma.equipmentLog.findUnique({ where: { id: logId } });
  if (!log) return;

  await deleteLogDocumentFiles("equipmentLogId", logId);
  await prisma.equipmentLog.delete({ where: { id: logId } });
  await recalcularCriticidadEquipo(log.equipoId);
  await revalidateEquipoAndCityFeed(log.equipoId);
}

// Desglose al hacer clic en una rebanada de EquipmentMaintenanceTypePieChart
// (ver lib/equipment-maintenance-type-stats.ts), mismo control de acceso que
// fetchRecordEntriesForType.
export async function fetchEquipmentLogsForType(
  cityId: string | null,
  tipoMantenimiento: string,
  range: MonthRange
): Promise<EquipmentMaintenanceTypeLogEntry[]> {
  const user = await requireUser();
  await assertCanViewCity(user, cityId);
  return getEquipmentLogsForType(cityId, tipoMantenimiento, range);
}
