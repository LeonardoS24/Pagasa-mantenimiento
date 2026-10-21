"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { collapseSpaces } from "@/lib/text-normalize";
import { CHECKLIST_LISTAS, getChecklistItems, type ChecklistLista } from "@/lib/checklist-runtime";
import type { ActionState } from "./user-actions";

const schema = z.object({
  lista: z.enum(CHECKLIST_LISTAS),
  nombre: z.string().trim().min(2, "El nombre del ítem es requerido").max(120),
  soloFugas: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
});

// Agrega un ítem al checklist de mantenimiento preventivo (ver
// lib/checklist-runtime.ts). Solo ADMIN: la lista aplica a todas las
// ciudades.
export async function addChecklistItem(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse({
    lista: formData.get("lista"),
    nombre: formData.get("nombre"),
    soloFugas: formData.get("soloFugas"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const lista = parsed.data.lista as ChecklistLista;
  const nombre = collapseSpaces(parsed.data.nombre);

  const actuales = await getChecklistItems(lista);
  if (actuales.some((i) => i.toLowerCase() === nombre.toLowerCase())) {
    return { error: `"${nombre}" ya está en ese checklist.` };
  }

  const maxOrden = await prisma.checklistItemExtra.aggregate({
    where: { lista },
    _max: { orden: true },
  });

  try {
    await prisma.checklistItemExtra.create({
      data: {
        lista,
        nombre,
        // Todos los checklists son de gas (ver lib/preventive-checklist.ts):
        // en cualquiera puede haber ítems que solo se revisan por fugas.
        soloFugas: parsed.data.soloFugas,
        orden: (maxOrden._max.orden ?? -1) + 1,
      },
    });
  } catch {
    return { error: `"${nombre}" ya está en ese checklist.` };
  }

  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Checklist preventivo",
    resumen: `Agregó "${nombre}"`,
    detalle: `Lista: ${lista}`,
  });

  revalidatePath("/admin/piezas");
  return { success: `Se agregó "${nombre}" al checklist.` };
}

// Solo se pueden quitar los ítems agregados a mano; los de la lista fija
// viven en el código (lib/preventive-checklist.ts).
export async function deleteChecklistItem(
  itemId: string,
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const item = await prisma.checklistItemExtra.findUnique({ where: { id: itemId } });
  if (!item) {
    return { error: "El ítem no existe." };
  }

  await prisma.checklistItemExtra.delete({ where: { id: itemId } });

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Checklist preventivo",
    resumen: `Quitó "${item.nombre}"`,
    detalle: `Lista: ${item.lista}`,
  });

  revalidatePath("/admin/piezas");
  return { success: `Se quitó "${item.nombre}" del checklist.` };
}
