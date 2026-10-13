"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { TRACTOCAMIONES_SLUG, SEMIRREMOLQUES_SLUG, MAX_SEMIRREMOLQUES_POR_CONJUNTO } from "@/lib/kino-sections";
import type { ActionState } from "./user-actions";

// Conjuntos de Transportadora Kino (ver ConjuntoTransporte en el schema):
// qué tractocamión jala qué semirremolques, como vienen en los dictámenes.
// Se edita igual que la ficha técnica: ADMIN o USUARIO con acceso ampliado.

const conjuntoSchema = z.object({
  nombre: z.preprocess(
    (v) => String(v ?? "").replace(/\s+/g, " ").trim(),
    z.string().min(1, "Escribe el nombre del conjunto (por ejemplo, Dictamen 05).").max(80, "El nombre es demasiado largo.")
  ),
  observaciones: z.preprocess((v) => {
    const s = String(v ?? "").trim();
    return s.length > 0 ? s : null;
  }, z.string().max(500, "Las observaciones son demasiado largas.").nullable()),
  tractocamionId: z.preprocess((v) => {
    const s = String(v ?? "").trim();
    return s.length > 0 ? s : null;
  }, z.string().nullable()),
});

function rutaApartados(citySlug: string) {
  revalidatePath(`/ciudades/${citySlug}/unidad-de-distribucion/${TRACTOCAMIONES_SLUG}`);
  revalidatePath(`/ciudades/${citySlug}/unidad-de-distribucion/${SEMIRREMOLQUES_SLUG}`);
}

// conjuntoId null = conjunto nuevo.
export async function saveConjunto(
  cityId: string,
  conjuntoId: string | null,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireElevatedEditor();
  // El rol dice si puede editar, no si puede editar ESTO (ver lib/access.ts).
  await assertCityAccessById(editor, cityId);

  const parsed = conjuntoSchema.safeParse({
    nombre: formData.get("nombre"),
    observaciones: formData.get("observaciones"),
    tractocamionId: formData.get("tractocamionId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { nombre, observaciones, tractocamionId } = parsed.data;

  // Semirremolques: hasta 2 (un full lleva dos, acoplados con dolly), sin
  // repetir y sin huecos.
  const semirremolqueIds = formData
    .getAll("semirremolqueId")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  if (new Set(semirremolqueIds).size !== semirremolqueIds.length) {
    return { error: "Elegiste el mismo semirremolque dos veces." };
  }
  if (semirremolqueIds.length > MAX_SEMIRREMOLQUES_POR_CONJUNTO) {
    return { error: `Un conjunto lleva como máximo ${MAX_SEMIRREMOLQUES_POR_CONJUNTO} semirremolques.` };
  }
  if (!tractocamionId && semirremolqueIds.length === 0) {
    return { error: "Elige al menos el tractocamión o un semirremolque." };
  }

  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) return { error: "La ciudad no existe." };

  if (conjuntoId) {
    const existente = await prisma.conjuntoTransporte.findUnique({ where: { id: conjuntoId } });
    if (!existente || existente.cityId !== cityId) return { error: "El conjunto ya no existe." };
  }

  // Los ids llegan del navegador: se comprueba que cada unidad sea de esta
  // ciudad y del apartado que le toca.
  if (tractocamionId) {
    const tracto = await prisma.vehicleRecord.findUnique({
      where: { id: tractocamionId },
      select: { section: { select: { cityId: true, slug: true } } },
    });
    if (!tracto || tracto.section.cityId !== cityId || tracto.section.slug !== TRACTOCAMIONES_SLUG) {
      return { error: "El tractocamión elegido no pertenece a Tractocamiones de esta ciudad." };
    }
  }
  const semis = await prisma.vehicleRecord.findMany({
    where: { id: { in: semirremolqueIds } },
    select: {
      id: true,
      numeroEconomico: true,
      section: { select: { cityId: true, slug: true } },
      conjuntoSemirremolque: { select: { conjuntoId: true, conjunto: { select: { nombre: true } } } },
    },
  });
  if (semis.length !== semirremolqueIds.length || semis.some((s) => s.section.cityId !== cityId || s.section.slug !== SEMIRREMOLQUES_SLUG)) {
    return { error: "Alguno de los semirremolques elegidos no pertenece a Semirremolques de esta ciudad." };
  }

  // Nombre único dentro de la ciudad (SQLite compara sin acentos de forma
  // literal, así que se compara aquí sin importar mayúsculas).
  const otros = await prisma.conjuntoTransporte.findMany({ where: { cityId, id: conjuntoId ? { not: conjuntoId } : undefined }, select: { nombre: true } });
  if (otros.some((o) => o.nombre.toLowerCase() === nombre.toLowerCase())) {
    return { error: `Ya existe un conjunto llamado "${nombre}".` };
  }

  // Un semirremolque solo puede estar en un conjunto: si ya estaba en otro,
  // se mueve a este (el formulario avisa antes de guardar).
  const movidos = semis
    .filter((s) => s.conjuntoSemirremolque && s.conjuntoSemirremolque.conjuntoId !== conjuntoId)
    .map((s) => `${s.numeroEconomico} (estaba en ${s.conjuntoSemirremolque!.conjunto.nombre})`);
  const ordenPorId = new Map(semirremolqueIds.map((id, i) => [id, i]));

  await prisma.$transaction(async (tx) => {
    const conjunto = conjuntoId
      ? await tx.conjuntoTransporte.update({ where: { id: conjuntoId }, data: { nombre, observaciones, tractocamionId } })
      : await tx.conjuntoTransporte.create({
          data: {
            cityId,
            nombre,
            observaciones,
            tractocamionId,
            orden: (await tx.conjuntoTransporte.count({ where: { cityId } })) + 1,
          },
        });
    // Se quitan los que ya no van en este conjunto y los elegidos que
    // estaban en otro; luego se agregan en el orden elegido.
    await tx.conjuntoSemirremolque.deleteMany({
      where: { OR: [{ conjuntoId: conjunto.id }, { vehicleRecordId: { in: semirremolqueIds } }] },
    });
    for (const id of semirremolqueIds) {
      await tx.conjuntoSemirremolque.create({ data: { conjuntoId: conjunto.id, vehicleRecordId: id, orden: ordenPorId.get(id) ?? 0 } });
    }
  });

  await logActivity({
    user: editor,
    accion: "EDITAR",
    entidad: "Conjunto de transporte",
    resumen: nombre,
    detalle: movidos.length ? `Se movieron: ${movidos.join(", ")}` : undefined,
    citySlug: city.slug,
  });

  rutaApartados(city.slug);
  return {
    success: `${conjuntoId ? "Conjunto actualizado" : "Conjunto creado"}.${movidos.length ? ` Se movieron: ${movidos.join(", ")}.` : ""}`,
  };
}

// Borra solo la agrupación: las unidades, sus fichas y sus bitácoras no se
// tocan. Igual que cualquier borrado, pide la contraseña y queda en la
// bitácora de actividad.
export async function deleteConjunto(conjuntoId: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const editor = await requireElevatedEditor();
  const passwordError = await verifySessionPassword(editor, formData.get("password"));
  if (passwordError) return { error: passwordError };

  const conjunto = await prisma.conjuntoTransporte.findUnique({ where: { id: conjuntoId }, include: { city: true } });
  if (!conjunto) return { error: "El conjunto ya no existe." };
  await assertCityAccessById(editor, conjunto.cityId);

  await logActivity({
    user: editor,
    accion: "ELIMINAR",
    entidad: "Conjunto de transporte",
    resumen: conjunto.nombre,
    citySlug: conjunto.city.slug,
  });
  await prisma.conjuntoTransporte.delete({ where: { id: conjuntoId } });

  rutaApartados(conjunto.city.slug);
  return { success: "Conjunto eliminado. Las unidades siguen igual." };
}
