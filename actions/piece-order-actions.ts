"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { sectionBasePath } from "@/lib/section-path";
import {
  pieceOrderStatusSchema,
  ordenTipoSchema,
  consumibleUnidadSchema,
  unidadParaTipo,
  esContable,
} from "@/lib/inventory-enums";
import type { ActionState } from "./user-actions";

const createPieceOrderSchema = z.object({
  tipo: ordenTipoSchema,
  nombre: z.preprocess(
    (value) => String(value ?? "").trim(),
    z.string().min(1, "El nombre es requerido").max(150)
  ),
  // Solo se usa cuando tipo === "CONSUMIBLE"; para los demás la unidad se
  // deduce sola (piezas).
  unidadConsumible: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : undefined;
  }, consumibleUnidadSchema.optional()),
  cantidad: z.preprocess(
    (value) => {
      const text = String(value ?? "").trim();
      return text.length > 0 ? Number(text) : undefined;
    },
    z
      .number({ required_error: "La cantidad es requerida", invalid_type_error: "Cantidad inválida" })
      .int("La cantidad debe ser un número entero")
      .min(1, "La cantidad debe ser al menos 1")
      .max(1000, "La cantidad no puede ser mayor a 1000")
  ),
  fechaOrden: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? new Date(text) : undefined;
  }, z.date({ required_error: "La fecha de la orden es requerida", invalid_type_error: "Fecha inválida" })),
  // Se puede registrar la orden ya aceptada/rechazada desde el mismo
  // formulario, sin tener que cambiarla después en la tabla.
  estado: pieceOrderStatusSchema.default("PENDIENTE"),
  // Unidad destino, si ya se sabe desde que se levanta la orden (ver
  // comentario en el schema sobre PieceOrder.vehicleRecordId).
  vehicleRecordId: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : undefined;
  }, z.string().optional()),
});

// Da de alta los renglones en el apartado de Inventarios de la misma ciudad
// al aceptar una orden (desde su creación o desde un cambio de estatus
// posterior). Los tipos contables se desglosan uno por uno —5 refacciones
// son 5 renglones independientes, cada uno con su propio estatus y su propio
// plazo de 5 días—; el consumible se queda en un solo renglón con el total
// (20 lts, no 20 renglones de 1 lt). No hace nada si la orden ya tiene
// renglones generados (evita duplicar si se acepta dos veces).
async function createInventoryItemsForAcceptedOrder(order: {
  id: string;
  cityId: string;
  citySlug: string;
  tipo: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  // null si quien registró la orden ya no existe como usuario.
  createdById: string | null;
  // Si ya se sabía la unidad destino al levantar la orden, el/los renglón(es)
  // nacen ya amarrados a ella (ver comentario en el schema).
  vehicleRecordId: string | null;
}) {
  const existing = await prisma.inventoryItem.count({ where: { pieceOrderId: order.id } });
  if (existing > 0) return;

  const inventarios = await prisma.section.findFirst({
    where: { cityId: order.cityId, parentId: null, slug: "inventarios" },
  });
  if (!inventarios) return;

  const contable = esContable(order.tipo as Parameters<typeof esContable>[0]);
  const filas = contable ? Array.from({ length: order.cantidad }, () => 1) : [order.cantidad];

  await prisma.inventoryItem.createMany({
    data: filas.map((cantidad) => ({
      sectionId: inventarios.id,
      pieceOrderId: order.id,
      tipo: order.tipo,
      nombre: order.nombre,
      unidad: order.unidad,
      cantidad,
      createdById: order.createdById,
      usedOnVehicleId: order.vehicleRecordId,
    })),
  });
  revalidatePath(sectionBasePath(order.citySlug, [inventarios]));
}

export async function createPieceOrder(
  sectionId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createPieceOrderSchema.safeParse({
    tipo: formData.get("tipo"),
    nombre: formData.get("nombre"),
    unidadConsumible: formData.get("unidadConsumible"),
    cantidad: formData.get("cantidad"),
    fechaOrden: formData.get("fechaOrden"),
    estado: formData.get("estado"),
    vehicleRecordId: formData.get("vehicleRecordId"),
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

  let vehicleRecordId: string | null = null;
  if (parsed.data.vehicleRecordId) {
    const vehicle = await prisma.vehicleRecord.findUnique({
      where: { id: parsed.data.vehicleRecordId },
      include: { section: true },
    });
    if (!vehicle || !vehicle.activo || vehicle.section.cityId !== section.cityId) {
      return { error: "La unidad destino seleccionada no es válida." };
    }
    vehicleRecordId = vehicle.id;
  }

  const unidad = unidadParaTipo(parsed.data.tipo, parsed.data.unidadConsumible);
  const order = await prisma.pieceOrder.create({
    data: {
      sectionId,
      createdById: editor.userId,
      tipo: parsed.data.tipo,
      nombre: parsed.data.nombre,
      unidad,
      cantidad: parsed.data.cantidad,
      fechaOrden: parsed.data.fechaOrden,
      estado: parsed.data.estado,
      vehicleRecordId,
    },
  });

  if (parsed.data.estado === "ACEPTADA") {
    await createInventoryItemsForAcceptedOrder({
      id: order.id,
      cityId: section.cityId,
      citySlug: section.city.slug,
      tipo: order.tipo,
      nombre: order.nombre,
      unidad: order.unidad,
      cantidad: order.cantidad,
      createdById: order.createdById,
      vehicleRecordId: order.vehicleRecordId,
    });
  }

  revalidatePath(sectionBasePath(section.city.slug, [section]));
  return { success: "Orden registrada." };
}

export async function updatePieceOrderEstado(
  orderId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireEditor();

  const parsed = pieceOrderStatusSchema.safeParse(formData.get("estado"));
  if (!parsed.success) {
    return { error: "Estatus inválido." };
  }

  const order = await prisma.pieceOrder.findUnique({
    where: { id: orderId },
    include: { section: { include: { city: true } } },
  });
  if (!order) {
    return { error: "El registro no existe." };
  }

  await prisma.pieceOrder.update({ where: { id: orderId }, data: { estado: parsed.data } });

  if (parsed.data === "ACEPTADA") {
    await createInventoryItemsForAcceptedOrder({
      id: order.id,
      cityId: order.section.cityId,
      citySlug: order.section.city.slug,
      tipo: order.tipo,
      nombre: order.nombre,
      unidad: order.unidad,
      cantidad: order.cantidad,
      createdById: order.createdById,
      vehicleRecordId: order.vehicleRecordId,
    });
  }

  revalidatePath(sectionBasePath(order.section.city.slug, [order.section]));
  return { success: "Estatus actualizado." };
}

export async function deletePieceOrder(orderId: string) {
  await requireElevatedEditor();

  const order = await prisma.pieceOrder.findUnique({
    where: { id: orderId },
    include: { section: { include: { city: true } } },
  });
  if (!order) return;

  await prisma.pieceOrder.delete({ where: { id: orderId } });
  revalidatePath(sectionBasePath(order.section.city.slug, [order.section]));
}
