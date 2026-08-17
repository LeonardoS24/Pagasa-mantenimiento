"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEditor, requireAdmin, checkSessionUserExists } from "@/lib/auth";
import { assertSectionAccess } from "@/lib/access";
import { logActivity } from "@/lib/activity-log";
import { collapseSpaces } from "@/lib/text-normalize";
import { isPlantAreaClave, plantAreaNombre } from "@/lib/plant-areas";
import { getAllPlantAreaChecklistItemNames, getPlantAreaChecklistItems } from "@/lib/plant-area-checklist-runtime";
import type { ActionState } from "./user-actions";

const requiredDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : undefined;
}, z.date({ required_error: "La fecha es requerida", invalid_type_error: "Fecha inválida" }));

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const checklistEntrySchema = z.object({
  item: z.string().min(1),
  hecho: z.boolean(),
  observacion: z.string().max(500).optional(),
});

const createLogSchema = z.object({
  area: z.string().refine(isPlantAreaClave, "Área inválida"),
  fecha: requiredDate,
  checklist: z.preprocess((value) => {
    try {
      return JSON.parse(String(value ?? "[]"));
    } catch {
      return [];
    }
  }, z.array(checklistEntrySchema)),
  responsable: optionalText(150),
  observaciones: optionalText(1000),
});

export async function createPlantAreaMaintenanceLog(
  sectionId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };
  // Ver lib/access.ts: el rol dice si puede editar, no si puede editar ESTO.
  await assertSectionAccess(editor, sectionId);

  const parsed = createLogSchema.safeParse({
    area: formData.get("area"),
    fecha: formData.get("fecha"),
    checklist: formData.get("checklist"),
    responsable: formData.get("responsable"),
    observaciones: formData.get("observaciones"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { city: true },
  });
  if (!section) {
    return { error: "El apartado no existe." };
  }

  const nombresValidos = await getAllPlantAreaChecklistItemNames(parsed.data.area);
  const checklist = parsed.data.checklist.filter((e) => nombresValidos.includes(e.item));

  await prisma.plantAreaMaintenanceLog.create({
    data: {
      sectionId,
      area: parsed.data.area,
      fecha: parsed.data.fecha,
      checklist: JSON.stringify(checklist),
      responsable: parsed.data.responsable,
      observaciones: parsed.data.observaciones,
      createdById: editor.userId,
    },
  });

  revalidatePath(`/ciudades/${section.city.slug}/area-planta/${parsed.data.area}`);
  return { success: "Se registró el mantenimiento del área." };
}

export async function deletePlantAreaMaintenanceLog(
  logId: string,
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const log = await prisma.plantAreaMaintenanceLog.findUnique({
    where: { id: logId },
    include: { section: { include: { city: true } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  await prisma.plantAreaMaintenanceLog.delete({ where: { id: logId } });

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Mantenimiento de área de Planta",
    resumen: `Eliminó un registro de "${plantAreaNombre(log.area)}"`,
    detalle: `Ciudad: ${log.section.city.name}`,
  });

  revalidatePath(`/ciudades/${log.section.city.slug}/area-planta/${log.area}`);
  return { success: "Se eliminó el registro." };
}

// Agrega un ítem al checklist de mantenimiento de un área de Planta en
// particular (ver lib/plant-area-checklist-runtime.ts). Solo ADMIN.
const addChecklistItemSchema = z.object({
  area: z.string().refine(isPlantAreaClave, "Área inválida"),
  nombre: z.string().trim().min(2, "El nombre del ítem es requerido").max(120),
});

export async function addPlantAreaChecklistItem(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = addChecklistItemSchema.safeParse({
    area: formData.get("area"),
    nombre: formData.get("nombre"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const nombre = collapseSpaces(parsed.data.nombre);
  const actuales = await getPlantAreaChecklistItems(parsed.data.area);
  if (actuales.some((i) => i.toLowerCase() === nombre.toLowerCase())) {
    return { error: `"${nombre}" ya está en ese checklist.` };
  }

  const maxOrden = await prisma.plantAreaChecklistItem.aggregate({
    where: { area: parsed.data.area },
    _max: { orden: true },
  });

  try {
    await prisma.plantAreaChecklistItem.create({
      data: { area: parsed.data.area, nombre, orden: (maxOrden._max.orden ?? -1) + 1 },
    });
  } catch {
    return { error: `"${nombre}" ya está en ese checklist.` };
  }

  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Checklist de área de Planta",
    resumen: `Agregó "${nombre}"`,
    detalle: `Área: ${plantAreaNombre(parsed.data.area)}`,
  });

  revalidatePath("/admin/piezas");
  return { success: `Se agregó "${nombre}" al checklist.` };
}

export async function deletePlantAreaChecklistItem(
  itemId: string,
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const item = await prisma.plantAreaChecklistItem.findUnique({ where: { id: itemId } });
  if (!item) {
    return { error: "El ítem no existe." };
  }

  await prisma.plantAreaChecklistItem.delete({ where: { id: itemId } });

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Checklist de área de Planta",
    resumen: `Quitó "${item.nombre}"`,
    detalle: `Área: ${plantAreaNombre(item.area)}`,
  });

  revalidatePath("/admin/piezas");
  return { success: `Se quitó "${item.nombre}" del checklist.` };
}
