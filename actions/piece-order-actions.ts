"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { sectionBasePath } from "@/lib/section-path";
import { pieceOrderStatusSchema } from "@/lib/inventory-enums";
import type { ActionState } from "./user-actions";

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const createPieceOrderSchema = z.object({
  pieza: z.preprocess(
    (value) => String(value ?? "").trim(),
    z.string().min(1, "La pieza es requerida").max(150)
  ),
  cantidad: optionalText(50),
  fechaOrden: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? new Date(text) : undefined;
  }, z.date({ required_error: "La fecha de la orden es requerida", invalid_type_error: "Fecha inválida" })),
});

export async function createPieceOrder(
  sectionId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createPieceOrderSchema.safeParse({
    pieza: formData.get("pieza"),
    cantidad: formData.get("cantidad"),
    fechaOrden: formData.get("fechaOrden"),
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

  await prisma.pieceOrder.create({
    data: {
      sectionId,
      createdById: editor.userId,
      ...parsed.data,
    },
  });

  revalidatePath(sectionBasePath(section.city.slug, [section]));
  return { success: "Orden de pieza registrada." };
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
    include: { section: { include: { city: true } }, inventoryItem: true },
  });
  if (!order) {
    return { error: "El registro no existe." };
  }

  await prisma.pieceOrder.update({ where: { id: orderId }, data: { estado: parsed.data } });

  // Al aceptar la orden (una sola vez), se crea la pieza correspondiente en
  // el apartado de Inventarios de la misma ciudad.
  if (parsed.data === "ACEPTADA" && !order.inventoryItem) {
    const inventarios = await prisma.section.findFirst({
      where: { cityId: order.section.cityId, parentId: null, slug: "inventarios" },
    });
    if (inventarios) {
      await prisma.inventoryItem.create({
        data: {
          sectionId: inventarios.id,
          pieceOrderId: order.id,
          pieza: order.pieza,
          cantidad: order.cantidad,
          createdById: order.createdById,
        },
      });
      revalidatePath(sectionBasePath(order.section.city.slug, [inventarios]));
    }
  }

  revalidatePath(sectionBasePath(order.section.city.slug, [order.section]));
  return { success: "Estatus actualizado." };
}

export async function deletePieceOrder(orderId: string) {
  await requireAdmin();

  const order = await prisma.pieceOrder.findUnique({
    where: { id: orderId },
    include: { section: { include: { city: true } } },
  });
  if (!order) return;

  await prisma.pieceOrder.delete({ where: { id: orderId } });
  revalidatePath(sectionBasePath(order.section.city.slug, [order.section]));
}
