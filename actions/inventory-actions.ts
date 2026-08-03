"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor } from "@/lib/auth";
import { sectionBasePath } from "@/lib/section-path";
import {
  inventoryItemStatusSchema,
  unidadAbreviatura,
  INVENTORY_POR_UTILIZAR_DAYS,
} from "@/lib/inventory-enums";
import type { ActionState } from "./user-actions";

// Pasa automáticamente a "UTILIZADA" cualquier pieza marcada "POR_UTILIZAR"
// hace 5 días o más. Se llama al cargar la página de Inventarios de una
// ciudad (no hay tareas programadas en este sistema), así que la fecha se
// pone al día cada vez que alguien la visita.
export async function sweepExpiredPorUtilizar(sectionId: string): Promise<void> {
  const threshold = new Date(Date.now() - INVENTORY_POR_UTILIZAR_DAYS * 24 * 60 * 60 * 1000);
  await prisma.inventoryItem.updateMany({
    where: { sectionId, estado: "POR_UTILIZAR", fechaPorUtilizarDesde: { lte: threshold } },
    data: { estado: "UTILIZADA", fechaUtilizada: new Date() },
  });
}

export async function updateInventoryItemEstado(
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireEditor();

  const parsed = inventoryItemStatusSchema.safeParse(formData.get("estado"));
  if (!parsed.success) {
    return { error: "Estatus inválido." };
  }

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: { section: { include: { city: true } } },
  });
  if (!item) {
    return { error: "El registro no existe." };
  }

  // "Utilizada" exige indicar en qué unidad se colocó la pieza: se valida que
  // exista, esté activa y sea de la misma ciudad que el inventario, y al
  // terminar se redirige a esa unidad para registrar el mantenimiento con los
  // datos de la pieza ya prellenados.
  if (parsed.data === "UTILIZADA") {
    const vehicleId = String(formData.get("vehicleRecordId") ?? "").trim();
    if (!vehicleId) {
      return { error: "Selecciona la unidad en la que se colocó la pieza." };
    }

    const vehicle = await prisma.vehicleRecord.findUnique({
      where: { id: vehicleId },
      include: { section: { include: { city: true } } },
    });
    if (!vehicle || !vehicle.activo || vehicle.section.cityId !== item.section.cityId) {
      return { error: "La unidad seleccionada no es válida." };
    }

    await prisma.inventoryItem.update({
      where: { id: itemId },
      data: {
        estado: "UTILIZADA",
        fechaUtilizada: item.fechaUtilizada ?? new Date(),
        usedOnVehicleId: vehicleId,
      },
    });

    revalidatePath(sectionBasePath(item.section.city.slug, [item.section]));

    const prefill = new URLSearchParams({
      prefillPieza: item.nombre,
      prefillCantidad: String(item.cantidad),
      prefillUnidad: unidadAbreviatura(item.unidad),
    });
    redirect(
      `/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}?${prefill.toString()}#mantenimiento`
    );
  }

  const data: {
    estado: string;
    fechaPorUtilizarDesde?: Date | null;
    fechaUtilizada?: Date | null;
  } = { estado: parsed.data };

  if (parsed.data === "POR_UTILIZAR" && item.estado !== "POR_UTILIZAR") {
    data.fechaPorUtilizarDesde = new Date();
  } else if (parsed.data === "EN_INVENTARIO") {
    data.fechaPorUtilizarDesde = null;
    data.fechaUtilizada = null;
  }

  await prisma.inventoryItem.update({ where: { id: itemId }, data });

  revalidatePath(sectionBasePath(item.section.city.slug, [item.section]));
  return { success: "Estatus actualizado." };
}

export async function deleteInventoryItem(itemId: string) {
  await requireAdmin();

  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    include: { section: { include: { city: true } } },
  });
  if (!item) return;

  await prisma.inventoryItem.delete({ where: { id: itemId } });
  revalidatePath(sectionBasePath(item.section.city.slug, [item.section]));
}
