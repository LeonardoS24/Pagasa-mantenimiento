"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { collapseSpaces } from "@/lib/text-normalize";
import {
  CAMPO_AMBITOS,
  CAMPO_APARTADOS,
  CAMPO_TIPOS,
  esSeccionPropia,
  idDeSeccionPropia,
  labelDeApartado,
  labelDeSeccion,
  seccionesPara,
  parseOpcionesTexto,
  type CampoAmbito,
} from "@/lib/custom-fields";
import type { ActionState } from "./user-actions";

const crearSchema = z
  .object({
    ambito: z.enum(CAMPO_AMBITOS),
    seccion: z.string().trim().min(1, "Elige en qué recuadro va"),
    // "" = en todos los apartados de esa ficha
    apartadoSlug: z.string().trim().optional(),
    etiqueta: z.string().trim().min(2, "El nombre del campo es requerido").max(80),
    tipo: z.enum(CAMPO_TIPOS),
    // Solo tiene sentido cuando tipo === "LISTA" (ver superRefine abajo):
    // una opción por línea, tal como el ADMIN las escribe en el textarea.
    opciones: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.tipo === "LISTA" && parseOpcionesTexto(data.opciones).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Escribe al menos una opción para el listado (una por línea).",
        path: ["opciones"],
      });
    }
  });

function apartadoValido(ambito: CampoAmbito, slug: string | null | undefined): string | null | "invalido" {
  const limpio = (slug ?? "").trim();
  if (!limpio) return null;
  return CAMPO_APARTADOS[ambito].some((a) => a.slug === limpio) ? limpio : "invalido";
}

// Dónde queda un campo: el recuadro tiene que existir en ese ámbito y, si es
// un recuadro propio de un apartado, el campo se ve en ese mismo apartado
// (vive dentro de ese recuadro). Si no, se guardaría pero no se mostraría.
async function validarUbicacion(
  ambito: CampoAmbito,
  seccion: string,
  apartadoPedido: string | null | undefined
): Promise<{ error: string } | { apartadoSlug: string | null }> {
  const apartado = apartadoValido(ambito, apartadoPedido);
  if (apartado === "invalido") return { error: "Ese apartado no existe en esa ficha." };
  if (esSeccionPropia(seccion)) {
    const propia = await prisma.customSection.findUnique({ where: { id: idDeSeccionPropia(seccion) } });
    if (!propia || propia.ambito !== ambito) return { error: "Ese recuadro no existe en esa ficha." };
    return { apartadoSlug: propia.apartadoSlug ?? apartado };
  }
  if (!seccionesPara(ambito).some((s) => s.id === seccion)) return { error: "Ese recuadro no existe en esa ficha." };
  return { apartadoSlug: apartado };
}

async function nombreDeSeccion(ambito: CampoAmbito, seccion: string): Promise<string> {
  const propias = esSeccionPropia(seccion)
    ? await prisma.customSection.findMany({ where: { id: idDeSeccionPropia(seccion) } })
    : [];
  return labelDeSeccion(
    ambito,
    seccion,
    propias.map((s) => ({ id: s.id, ambito: s.ambito as CampoAmbito, apartadoSlug: s.apartadoSlug, titulo: s.titulo, orden: s.orden }))
  );
}

function campoUbicacion(ambito: CampoAmbito, apartadoSlug: string | null, recuadro: string): string {
  return `${ambito === "ESTACION" ? "Estación" : "Unidad"} / ${labelDeApartado(ambito, apartadoSlug)} / ${recuadro}`;
}

// Agrega un campo nuevo a una ficha técnica. Solo ADMIN: cambia lo que ven
// todas las ciudades.
export async function addCustomField(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = crearSchema.safeParse({
    ambito: formData.get("ambito"),
    seccion: formData.get("seccion"),
    apartadoSlug: formData.get("apartadoSlug") ?? "",
    etiqueta: formData.get("etiqueta"),
    tipo: formData.get("tipo"),
    // El cuadro de opciones solo existe cuando el tipo es listado: en los
    // demás tipos llega null, que no es un texto válido.
    opciones: formData.get("opciones") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { ambito, seccion, tipo } = parsed.data;
  const etiqueta = collapseSpaces(parsed.data.etiqueta);
  // Se guarda ya limpio (sin líneas vacías ni duplicados) para que el
  // <select> del formulario salga igual la próxima vez que se lea.
  const opciones = tipo === "LISTA" ? parseOpcionesTexto(parsed.data.opciones).join("\n") : null;

  const ubicacion = await validarUbicacion(ambito as CampoAmbito, seccion, parsed.data.apartadoSlug);
  if ("error" in ubicacion) return { error: ubicacion.error };
  const { apartadoSlug } = ubicacion;

  const repetido = await prisma.customField.findFirst({ where: { ambito, seccion, apartadoSlug, etiqueta } });
  if (repetido) {
    return { error: `Ya hay un campo llamado "${etiqueta}" en ese recuadro para ese apartado.` };
  }

  const maxOrden = await prisma.customField.aggregate({
    where: { ambito, seccion },
    _max: { orden: true },
  });

  await prisma.customField.create({
    data: { ambito, seccion, apartadoSlug, etiqueta, tipo, opciones, orden: (maxOrden._max.orden ?? -1) + 1 },
  });

  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Campos de ficha técnica",
    resumen: `Agregó el campo "${etiqueta}"`,
    detalle: `${campoUbicacion(ambito as CampoAmbito, apartadoSlug, await nombreDeSeccion(ambito as CampoAmbito, seccion))} · Tipo: ${tipo}`,
  });

  revalidatePath("/admin/campos");
  return { success: `Se agregó el campo "${etiqueta}".` };
}

// Edita un campo: nombre, apartado, recuadro y, si es un listado, sus
// opciones. El TIPO no se cambia (lo ya capturado dejaría de tener sentido:
// una fecha no es un número). Cambiar cualquier otra cosa NO borra lo
// capturado: los valores se guardan contra el id del campo.
export async function updateCustomField(
  fieldId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const etiqueta = collapseSpaces(String(formData.get("etiqueta") ?? ""));
  if (etiqueta.length < 2) return { error: "El nombre del campo es requerido." };
  if (etiqueta.length > 80) return { error: "El nombre es demasiado largo." };

  const campo = await prisma.customField.findUnique({ where: { id: fieldId } });
  if (!campo) return { error: "El campo no existe." };
  const ambito = campo.ambito as CampoAmbito;

  const seccion = String(formData.get("seccion") ?? campo.seccion).trim() || campo.seccion;
  const apartadoPedido = formData.has("apartadoSlug") ? String(formData.get("apartadoSlug") ?? "") : campo.apartadoSlug;
  const ubicacion = await validarUbicacion(ambito, seccion, apartadoPedido);
  if ("error" in ubicacion) return { error: ubicacion.error };
  const { apartadoSlug } = ubicacion;

  let opciones = campo.opciones;
  if (campo.tipo === "LISTA") {
    const lista = parseOpcionesTexto(String(formData.get("opciones") ?? campo.opciones ?? ""));
    if (lista.length === 0) return { error: "Escribe al menos una opción para el listado (una por línea)." };
    opciones = lista.join("\n");
  }

  const repetido = await prisma.customField.findFirst({
    where: { ambito, seccion, apartadoSlug, etiqueta, id: { not: fieldId } },
  });
  if (repetido) return { error: `Ya hay un campo llamado "${etiqueta}" en ese recuadro para ese apartado.` };

  // Si cambia de recuadro va al final del nuevo.
  let orden = campo.orden;
  if (seccion !== campo.seccion) {
    const max = await prisma.customField.aggregate({ where: { ambito, seccion }, _max: { orden: true } });
    orden = (max._max.orden ?? -1) + 1;
  }

  await prisma.customField.update({ where: { id: fieldId }, data: { etiqueta, seccion, apartadoSlug, opciones, orden } });

  const cambios: string[] = [];
  if (etiqueta !== campo.etiqueta) cambios.push(`nombre "${campo.etiqueta}" → "${etiqueta}"`);
  if (apartadoSlug !== campo.apartadoSlug) cambios.push(`apartado ${labelDeApartado(ambito, campo.apartadoSlug)} → ${labelDeApartado(ambito, apartadoSlug)}`);
  if (seccion !== campo.seccion) cambios.push(`recuadro ${await nombreDeSeccion(ambito, campo.seccion)} → ${await nombreDeSeccion(ambito, seccion)}`);
  if (opciones !== campo.opciones) cambios.push("opciones del listado");
  if (cambios.length > 0) {
    await logActivity({
      user: admin,
      accion: "EDITAR",
      entidad: "Campos de ficha técnica",
      resumen: `Editó el campo "${etiqueta}"`,
      detalle: cambios.join(" · "),
    });
  }

  revalidatePath("/admin/campos");
  return { success: "Campo actualizado." };
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

// ── Recuadros propios ────────────────────────────────────────────────────

const recuadroSchema = z.object({
  ambito: z.enum(CAMPO_AMBITOS),
  apartadoSlug: z.string().trim().optional(),
  titulo: z.string().trim().min(2, "El título del recuadro es requerido").max(80),
});

// Crea un recuadro nuevo en la ficha de un apartado (p. ej. cuando una norma
// pide una sección que no existe). Los campos se agregan después dentro de él.
export async function addCustomSection(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = recuadroSchema.safeParse({
    ambito: formData.get("ambito"),
    apartadoSlug: formData.get("apartadoSlug") ?? "",
    titulo: formData.get("titulo"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const ambito = parsed.data.ambito as CampoAmbito;
  const apartadoSlug = apartadoValido(ambito, parsed.data.apartadoSlug);
  if (apartadoSlug === "invalido") return { error: "Ese apartado no existe en esa ficha." };
  const titulo = collapseSpaces(parsed.data.titulo);

  const repetido = await prisma.customSection.findFirst({ where: { ambito, apartadoSlug, titulo } });
  if (repetido) return { error: `Ya hay un recuadro llamado "${titulo}" en ese apartado.` };

  const max = await prisma.customSection.aggregate({ where: { ambito }, _max: { orden: true } });
  await prisma.customSection.create({ data: { ambito, apartadoSlug, titulo, orden: (max._max.orden ?? -1) + 1 } });

  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Recuadros de ficha técnica",
    resumen: `Creó el recuadro "${titulo}"`,
    detalle: `${ambito === "ESTACION" ? "Estación" : "Unidad"} / ${labelDeApartado(ambito, apartadoSlug)}`,
  });
  revalidatePath("/admin/campos");
  return { success: `Se creó el recuadro "${titulo}". Ya puedes agregarle campos.` };
}

export async function renameCustomSection(sectionId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const titulo = collapseSpaces(String(formData.get("titulo") ?? ""));
  if (titulo.length < 2) return { error: "El título del recuadro es requerido." };
  if (titulo.length > 80) return { error: "El título es demasiado largo." };

  const seccion = await prisma.customSection.findUnique({ where: { id: sectionId } });
  if (!seccion) return { error: "El recuadro no existe." };
  const repetido = await prisma.customSection.findFirst({
    where: { ambito: seccion.ambito, apartadoSlug: seccion.apartadoSlug, titulo, id: { not: sectionId } },
  });
  if (repetido) return { error: `Ya hay un recuadro llamado "${titulo}" en ese apartado.` };

  await prisma.customSection.update({ where: { id: sectionId }, data: { titulo } });
  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Recuadros de ficha técnica",
    resumen: `Renombró el recuadro "${seccion.titulo}" a "${titulo}"`,
  });
  revalidatePath("/admin/campos");
  return { success: "Título actualizado." };
}

export async function moveCustomSection(sectionId: string, direccion: "arriba" | "abajo"): Promise<ActionState> {
  await requireAdmin();
  const seccion = await prisma.customSection.findUnique({ where: { id: sectionId } });
  if (!seccion) return { error: "El recuadro no existe." };

  const hermanos = await prisma.customSection.findMany({
    where: { ambito: seccion.ambito, apartadoSlug: seccion.apartadoSlug },
    orderBy: [{ orden: "asc" }, { createdAt: "asc" }],
  });
  const i = hermanos.findIndex((s) => s.id === sectionId);
  const j = direccion === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= hermanos.length) return { error: "Ya está en el extremo." };

  // Se reasigna el orden 0..n-1 a todos los hermanos, así queda único aunque
  // antes hubiera empates.
  const nuevo = [...hermanos];
  [nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]];
  await prisma.$transaction(nuevo.map((s, k) => prisma.customSection.update({ where: { id: s.id }, data: { orden: k } })));
  revalidatePath("/admin/campos");
  return { success: "Orden actualizado." };
}

// Un recuadro con campos adentro no se borra: primero hay que mover o quitar
// sus campos. Así borrar un recuadro nunca arrastra lo capturado en silencio.
export async function deleteCustomSection(sectionId: string): Promise<ActionState> {
  const admin = await requireAdmin();
  const seccion = await prisma.customSection.findUnique({ where: { id: sectionId } });
  if (!seccion) return { error: "El recuadro no existe." };

  const campos = await prisma.customField.count({ where: { seccion: `x:${sectionId}` } });
  if (campos > 0) {
    return { error: `El recuadro todavía tiene ${campos} campo(s). Muévelos a otro recuadro o quítalos primero.` };
  }
  await prisma.customSection.delete({ where: { id: sectionId } });
  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Recuadros de ficha técnica",
    resumen: `Quitó el recuadro "${seccion.titulo}"`,
  });
  revalidatePath("/admin/campos");
  return { success: `Se quitó el recuadro "${seccion.titulo}".` };
}
