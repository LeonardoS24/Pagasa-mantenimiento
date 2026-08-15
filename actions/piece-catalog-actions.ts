"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { collapseSpaces } from "@/lib/text-normalize";
import { normalizePieceName } from "@/lib/learned-pieces";
import {
  PIECE_CATALOG,
  PIECE_CATEGORY_OTRO,
  PIECE_GROUPS,
  CATEGORIA_NUEVA,
} from "@/lib/piece-catalog";
import { GRUPO_ESTACIONES, GRUPO_UNIDADES, getPieceCatalog } from "@/lib/piece-catalog-runtime";
import type { ActionState } from "./user-actions";

const schema = z.object({
  grupo: z.enum(PIECE_GROUPS),
  // Categoría existente elegida del selector, o "__NUEVA__" para escribirla.
  categoria: z.string().trim().min(1, "Elige una categoría"),
  categoriaNueva: z.string().trim().max(60).optional(),
  nombre: z.string().trim().min(2, "El nombre de la pieza es requerido").max(120),
});

// Agrega una pieza al catálogo que usan los formularios de mantenimiento y de
// órdenes (ver lib/piece-catalog-runtime.ts). Solo ADMIN: es una lista que
// afecta a todas las ciudades.
export async function addCatalogPiece(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse({
    grupo: formData.get("grupo"),
    categoria: formData.get("categoria"),
    categoriaNueva: formData.get("categoriaNueva"),
    nombre: formData.get("nombre"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { grupo } = parsed.data;
  const categoria = collapseSpaces(
    parsed.data.categoria === CATEGORIA_NUEVA ? parsed.data.categoriaNueva ?? "" : parsed.data.categoria
  );
  const nombre = collapseSpaces(parsed.data.nombre);

  if (!categoria) {
    return { error: "Escribe el nombre de la categoría nueva." };
  }
  if (categoria === PIECE_CATEGORY_OTRO) {
    return {
      error: '"Otro" no es una categoría con lista propia: ahí la pieza se escribe a mano al capturar.',
    };
  }

  // Si la categoría es de la lista fija, su grupo ya está definido en el
  // código y no se puede mover; solo las categorías nuevas guardan grupo.
  const esCategoriaFija = categoria in PIECE_CATALOG;
  const grupoGuardado = esCategoriaFija
    ? null
    : grupo === "Estaciones de carburación"
    ? GRUPO_ESTACIONES
    : GRUPO_UNIDADES;

  // No repetir una pieza que ya existe en esa categoría, venga de la lista
  // fija o de una agregada antes (sin importar mayúsculas/acentos).
  const catalogo = await getPieceCatalog();
  const yaExiste = (catalogo[categoria] ?? []).some(
    (p) => normalizePieceName(p) === normalizePieceName(nombre)
  );
  if (yaExiste) {
    return { error: `"${nombre}" ya está en la categoría "${categoria}".` };
  }

  try {
    await prisma.learnedPiece.create({ data: { categoria, nombre, grupo: grupoGuardado } });
  } catch {
    return { error: `"${nombre}" ya está en la categoría "${categoria}".` };
  }

  // "EDITAR" y no "CREAR": el catálogo es una sola lista del sistema y lo que
  // se registra es que se modificó (ver lib/activity-log.ts, que solo maneja
  // ELIMINAR/EDITAR).
  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Catálogo de piezas",
    resumen: `Agregó "${nombre}" a ${categoria}`,
    detalle: `Grupo: ${grupo}`,
  });

  revalidatePath("/admin/piezas");
  return { success: `Se agregó "${nombre}" a ${categoria}.` };
}

// Solo se pueden borrar las piezas agregadas a mano: las de la lista fija
// viven en el código (lib/piece-catalog.ts).
export async function deleteCatalogPiece(
  pieceId: string,
  _prevState: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const pieza = await prisma.learnedPiece.findUnique({ where: { id: pieceId } });
  if (!pieza) {
    return { error: "La pieza no existe." };
  }

  await prisma.learnedPiece.delete({ where: { id: pieceId } });

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Catálogo de piezas",
    resumen: `Quitó "${pieza.nombre}" de ${pieza.categoria}`,
  });

  revalidatePath("/admin/piezas");
  return { success: `Se quitó "${pieza.nombre}" del catálogo.` };
}
