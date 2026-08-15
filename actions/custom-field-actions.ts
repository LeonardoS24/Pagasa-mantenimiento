"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { collapseSpaces } from "@/lib/text-normalize";
import {
  CAMPO_AMBITOS,
  CAMPO_TIPOS,
  labelDeSeccion,
  seccionesPara,
  type CampoAmbito,
} from "@/lib/custom-fields";
import type { ActionState } from "./user-actions";

const crearSchema = z.object({
  ambito: z.enum(CAMPO_AMBITOS),
  seccion: z.string().trim().min(1, "Elige en qué recuadro va"),
  etiqueta: z.string().trim().min(2, "El nombre del campo es requerido").max(80),
  tipo: z.enum(CAMPO_TIPOS),
});

// Agrega un recuadro nuevo a una ficha técnica. Solo ADMIN: cambia lo que
// ven todas las ciudades.
export async function addCustomField(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = crearSchema.safeParse({
    ambito: formData.get("ambito"),
    seccion: formData.get("seccion"),
    etiqueta: formData.get("etiqueta"),
    tipo: formData.get("tipo"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { ambito, seccion, tipo } = parsed.data;
  const etiqueta = collapseSpaces(parsed.data.etiqueta);

  // La sección tiene que ser una de las de ese ámbito: si no, el campo se
  // guardaría pero no se mostraría en ningún lado.
  if (!seccionesPara(ambito as CampoAmbito).some((s) => s.id === seccion)) {
    return { error: "Ese recuadro no existe en esa ficha." };
  }

  const repetido = await prisma.customField.findFirst({
    where: { ambito, seccion, etiqueta },
  });
  if (repetido) {
    return { error: `Ya hay un campo llamado "${etiqueta}" en ese recuadro.` };
  }

  const maxOrden = await prisma.customField.aggregate({
    where: { ambito, seccion },
    _max: { orden: true },
  });

  await prisma.customField.create({
    data: { ambito, seccion, etiqueta, tipo, orden: (maxOrden._max.orden ?? -1) + 1 },
  });

  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Campos de ficha técnica",
    resumen: `Agregó el campo "${etiqueta}"`,
    detalle: `${campoUbicacion(ambito as CampoAmbito, seccion)} · Tipo: ${tipo}`,
  });

  revalidatePath("/admin/campos");
  return { success: `Se agregó el campo "${etiqueta}".` };
}

function campoUbicacion(ambito: CampoAmbito, seccion: string): string {
  return `${ambito === "ESTACION" ? "Estación" : "Unidad"} / ${labelDeSeccion(ambito, seccion)}`;
}

// Cambiar el nombre de un campo NO borra lo capturado: los valores se
// guardan contra el id del campo, no contra su etiqueta.
export async function renameCustomField(
  fieldId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const etiqueta = collapseSpaces(String(formData.get("etiqueta") ?? ""));
  if (etiqueta.length < 2) {
    return { error: "El nombre del campo es requerido." };
  }
  if (etiqueta.length > 80) {
    return { error: "El nombre es demasiado largo." };
  }

  const campo = await prisma.customField.findUnique({ where: { id: fieldId } });
  if (!campo) return { error: "El campo no existe." };

  const repetido = await prisma.customField.findFirst({
    where: { ambito: campo.ambito, seccion: campo.seccion, etiqueta, id: { not: fieldId } },
  });
  if (repetido) {
    return { error: `Ya hay un campo llamado "${etiqueta}" en ese recuadro.` };
  }

  await prisma.customField.update({ where: { id: fieldId }, data: { etiqueta } });

  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Campos de ficha técnica",
    resumen: `Renombró "${campo.etiqueta}" a "${etiqueta}"`,
  });

  revalidatePath("/admin/campos");
  return { success: "Nombre actualizado." };
}

// Sube o baja un campo dentro de su recuadro, intercambiando el orden con su
// vecino. Más simple y predecible que arrastrar, y no depende de JavaScript
// del lado del cliente para funcionar.
export async function moveCustomField(
  fieldId: string,
  direccion: "arriba" | "abajo"
): Promise<ActionState> {
  await requireAdmin();

  const campo = await prisma.customField.findUnique({ where: { id: fieldId } });
  if (!campo) return { error: "El campo no existe." };

  const hermanos = await prisma.customField.findMany({
    where: { ambito: campo.ambito, seccion: campo.seccion },
    orderBy: { orden: "asc" },
  });
  const i = hermanos.findIndex((c) => c.id === fieldId);
  const j = direccion === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= hermanos.length) {
    return { error: "Ya está en el extremo." };
  }

  // Intercambio en dos pasos con un valor temporal: el orden no es único en
  // la base, pero así queda claro y no depende de que lo sea.
  await prisma.$transaction([
    prisma.customField.update({ where: { id: hermanos[i].id }, data: { orden: -1 } }),
    prisma.customField.update({ where: { id: hermanos[j].id }, data: { orden: hermanos[i].orden } }),
    prisma.customField.update({ where: { id: hermanos[i].id }, data: { orden: hermanos[j].orden } }),
  ]);

  revalidatePath("/admin/campos");
  return { success: "Orden actualizado." };
}

// Borrar el campo borra también lo capturado en todas las unidades (la
// relación es onDelete: Cascade), por eso el panel avisa cuántos valores se
// van a perder antes de confirmar.
export async function deleteCustomField(fieldId: string): Promise<ActionState> {
  const admin = await requireAdmin();

  const campo = await prisma.customField.findUnique({
    where: { id: fieldId },
    include: { _count: { select: { valores: true } } },
  });
  if (!campo) return { error: "El campo no existe." };

  await prisma.customField.delete({ where: { id: fieldId } });

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Campos de ficha técnica",
    resumen: `Quitó el campo "${campo.etiqueta}"`,
    detalle: `Se borraron ${campo._count.valores} valor(es) capturado(s)`,
  });

  revalidatePath("/admin/campos");
  return { success: `Se quitó "${campo.etiqueta}".` };
}
