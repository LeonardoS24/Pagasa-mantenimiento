"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { collapseSpaces } from "@/lib/text-normalize";
import { CAMPO_TIPOS, aplicaAApartado, parseOpcionesTexto } from "@/lib/custom-fields";
import { APARTADOS_ACOMODABLES, RECUADROS_FICHA, leerDiseno, type DisenoFicha } from "@/lib/diseno-ficha";

export type ResultadoDiseno = { ok: true; resumen?: string } | { ok: false; error: string };

// Entrar al editor pide la contraseña de quien está en sesión: lo que se
// cambia ahí lo ven todos los usuarios. Esta solo abre la puerta; guardar la
// vuelve a pedir y es la que de verdad protege (ver guardarEditorFicha).
export async function abrirEditorDiseno(password: string): Promise<ResultadoDiseno> {
  const admin = await requireAdmin();
  const error = await verifySessionPassword(admin, password);
  return error ? { ok: false, error } : { ok: true };
}

const id = z.string().min(1).max(40);
const tempId = z.string().regex(/^n\d{1,6}$/);
const titulo = z.string().trim().min(2, "El título de un recuadro es muy corto.").max(80, "El título de un recuadro es muy largo.");
const etiqueta = z.string().trim().min(2, "El nombre de un campo es muy corto.").max(80, "El nombre de un campo es muy largo.");
const opciones = z.array(z.string().trim().min(1).max(100)).max(100).optional();

const cambiosSchema = z.object({
  recuadrosNuevos: z.array(z.object({ tempId, titulo })).max(50),
  recuadrosRenombrados: z.array(z.object({ id, titulo })).max(100),
  recuadrosEliminados: z.array(id).max(100),
  // seccion = clave del recuadro en el editor: de fábrica ("visual-externa"),
  // propio ("x:<id>") o propio nuevo ("x:n3").
  camposNuevos: z.array(z.object({ tempId, seccion: z.string().max(60), etiqueta, tipo: z.enum(CAMPO_TIPOS), opciones })).max(200),
  camposEditados: z.array(z.object({ id, etiqueta, opciones })).max(300),
  camposEliminados: z.array(id).max(300),
  // clave del recuadro → ids de sus campos (reales o nuevos) en orden.
  ordenCampos: z.record(z.string().max(60), z.array(z.string().max(40)).max(200)),
  diseno: z.record(z.string().max(60), z.unknown()),
});

export type CambiosEditorFicha = z.infer<typeof cambiosSchema>;

const norm = (t: string) => collapseSpaces(t).toLowerCase();

// Guarda de un jalón todo lo que se hizo en el editor de la ficha de un
// apartado: recuadros nuevos (en el lugar elegido), renombrados y eliminados;
// campos nuevos, editados, quitados y su orden; y el acomodo (orden, ancho,
// color y ocultos). Todo o nada, con la contraseña de quien guarda.
export async function guardarEditorFicha(apartadoSlug: string, entrada: unknown, password: string): Promise<ResultadoDiseno> {
  const admin = await requireAdmin();

  const apartado = APARTADOS_ACOMODABLES.find((a) => a.slug === apartadoSlug);
  if (!apartado) return { ok: false, error: "Ese apartado no se puede editar aquí." };

  const parsed = cambiosSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Los cambios no son válidos." };
  const c = parsed.data;

  const errorClave = await verifySessionPassword(admin, password);
  if (errorClave) return { ok: false, error: errorClave };

  // Lo que hoy existe y se ve en este apartado.
  const fabrica = RECUADROS_FICHA.filter((r) => r.aplica(apartadoSlug));
  const propios = (
    await prisma.customSection.findMany({ where: { ambito: "VEHICULO" } })
  ).filter((s) => aplicaAApartado(s.apartadoSlug, apartadoSlug));
  const idsPropios = new Set(propios.map((s) => s.id));
  const seccionesValidas = new Set<string>([...fabrica.map((r) => r.seccionCampos), ...propios.map((s) => `x:${s.id}`)]);
  const campos = (await prisma.customField.findMany({ where: { ambito: "VEHICULO" } })).filter(
    (f) => aplicaAApartado(f.apartadoSlug, apartadoSlug) && seccionesValidas.has(f.seccion)
  );
  const camposPorId = new Map(campos.map((f) => [f.id, f]));

  // Validaciones antes de tocar nada.
  for (const r of c.recuadrosRenombrados) if (!idsPropios.has(r.id)) return { ok: false, error: "Un recuadro que renombraste ya no existe." };
  for (const r of c.recuadrosEliminados) if (!idsPropios.has(r)) return { ok: false, error: "Un recuadro que eliminaste ya no existe." };
  for (const f of [...c.camposEliminados, ...c.camposEditados.map((x) => x.id)]) {
    if (!camposPorId.has(f)) return { ok: false, error: "Un campo que cambiaste ya no existe. Recarga la página." };
  }
  const tempsRecuadro = new Set(c.recuadrosNuevos.map((r) => r.tempId));
  // clave del editor → seccion con la que se guardan los campos.
  const seccionDe = (clave: string): string | null => {
    const fab = fabrica.find((r) => r.clave === clave);
    if (fab) return fab.seccionCampos;
    if (clave.startsWith("x:")) {
      const resto = clave.slice(2);
      if (idsPropios.has(resto) && !c.recuadrosEliminados.includes(resto)) return clave;
      if (tempsRecuadro.has(resto)) return clave; // se traduce al id real al crearlo
    }
    return null;
  };
  for (const f of c.camposNuevos) {
    if (!seccionDe(f.seccion)) return { ok: false, error: `El campo «${f.etiqueta}» va en un recuadro que no existe en esta ficha.` };
    if (f.tipo === "LISTA" && (f.opciones ?? []).length === 0) return { ok: false, error: `El listado «${f.etiqueta}» necesita al menos una opción.` };
  }
  for (const f of c.camposEditados) {
    if (camposPorId.get(f.id)!.tipo === "LISTA" && f.opciones && f.opciones.length === 0) {
      return { ok: false, error: `El listado «${f.etiqueta}» necesita al menos una opción.` };
    }
  }

  // Nombres repetidos dentro de un mismo recuadro (lo que quedará al final).
  const eliminados = new Set(c.camposEliminados);
  const finales = new Map<string, string[]>();
  for (const f of campos) {
    if (eliminados.has(f.id)) continue;
    if (f.seccion.startsWith("x:") && c.recuadrosEliminados.includes(f.seccion.slice(2))) continue;
    const editado = c.camposEditados.find((x) => x.id === f.id);
    finales.set(f.seccion, [...(finales.get(f.seccion) ?? []), norm(editado?.etiqueta ?? f.etiqueta)]);
  }
  for (const f of c.camposNuevos) {
    const s = seccionDe(f.seccion)!;
    finales.set(s, [...(finales.get(s) ?? []), norm(f.etiqueta)]);
  }
  for (const nombres of finales.values()) {
    const repetido = nombres.find((n, i) => nombres.indexOf(n) !== i);
    if (repetido) return { ok: false, error: `Hay dos campos llamados «${repetido}» en el mismo recuadro.` };
  }
  const titulosFinales = [
    ...propios.filter((s) => !c.recuadrosEliminados.includes(s.id)).map((s) => norm(c.recuadrosRenombrados.find((r) => r.id === s.id)?.titulo ?? s.titulo)),
    ...c.recuadrosNuevos.map((r) => norm(r.titulo)),
  ];
  const tituloRepetido = titulosFinales.find((t, i) => titulosFinales.indexOf(t) !== i);
  if (tituloRepetido) return { ok: false, error: `Hay dos recuadros llamados «${tituloRepetido}».` };

  let resumen = "";
  await prisma.$transaction(async (tx) => {
    // 1. Recuadros nuevos (solo de este apartado).
    const realDeTemp = new Map<string, string>();
    const max = await tx.customSection.aggregate({ where: { ambito: "VEHICULO" }, _max: { orden: true } });
    let orden = (max._max.orden ?? -1) + 1;
    for (const r of c.recuadrosNuevos) {
      const nuevo = await tx.customSection.create({ data: { ambito: "VEHICULO", apartadoSlug, titulo: collapseSpaces(r.titulo), orden: orden++ } });
      realDeTemp.set(r.tempId, nuevo.id);
    }
    const claveReal = (clave: string) => (clave.startsWith("x:") && realDeTemp.has(clave.slice(2)) ? `x:${realDeTemp.get(clave.slice(2))}` : clave);
    const seccionReal = (clave: string) => claveReal(seccionDe(clave)!);

    // 2. Renombrados.
    for (const r of c.recuadrosRenombrados) await tx.customSection.update({ where: { id: r.id }, data: { titulo: collapseSpaces(r.titulo) } });

    // 3. Recuadros eliminados, con sus campos (los datos capturados se van con ellos).
    for (const r of c.recuadrosEliminados) {
      await tx.customField.deleteMany({ where: { seccion: `x:${r}` } });
      await tx.customSection.delete({ where: { id: r } });
    }

    // 4. Campos quitados y editados.
    if (c.camposEliminados.length > 0) await tx.customField.deleteMany({ where: { id: { in: c.camposEliminados } } });
    for (const f of c.camposEditados) {
      const actual = camposPorId.get(f.id)!;
      await tx.customField.update({
        where: { id: f.id },
        data: {
          etiqueta: collapseSpaces(f.etiqueta),
          ...(actual.tipo === "LISTA" && f.opciones ? { opciones: parseOpcionesTexto(f.opciones.join("\n")).join("\n") } : {}),
        },
      });
    }

    // 5. Campos nuevos (solo de este apartado).
    const campoDeTemp = new Map<string, string>();
    for (const f of c.camposNuevos) {
      const nuevo = await tx.customField.create({
        data: {
          ambito: "VEHICULO",
          seccion: seccionReal(f.seccion),
          apartadoSlug,
          etiqueta: collapseSpaces(f.etiqueta),
          tipo: f.tipo,
          opciones: f.tipo === "LISTA" ? parseOpcionesTexto((f.opciones ?? []).join("\n")).join("\n") : null,
          orden: 0,
        },
      });
      campoDeTemp.set(f.tempId, nuevo.id);
    }

    // 6. Orden de los campos dentro de cada recuadro.
    for (const [clave, ids] of Object.entries(c.ordenCampos)) {
      if (!seccionDe(clave)) continue;
      const seccion = seccionReal(clave);
      let k = 0;
      for (const idCampo of ids) {
        const real = campoDeTemp.get(idCampo) ?? idCampo;
        await tx.customField.updateMany({ where: { id: real, seccion }, data: { orden: k++ } });
      }
    }

    // 7. Acomodo: claves nuevas al id real; fuera lo que ya no existe.
    const validas = new Set([
      ...fabrica.map((r) => r.clave),
      ...propios.filter((s) => !c.recuadrosEliminados.includes(s.id)).map((s) => `x:${s.id}`),
      ...[...realDeTemp.values()].map((v) => `x:${v}`),
    ]);
    const diseno: DisenoFicha = {};
    for (const [clave, ajuste] of Object.entries(leerDiseno(JSON.stringify(c.diseno)))) {
      const real = claveReal(clave);
      if (validas.has(real)) diseno[real] = ajuste;
    }
    if (Object.keys(diseno).length === 0) {
      await tx.disenoFicha.deleteMany({ where: { apartadoSlug } });
    } else {
      const datos = JSON.stringify(diseno);
      await tx.disenoFicha.upsert({
        where: { apartadoSlug },
        update: { datos, updatedById: admin.userId },
        create: { apartadoSlug, datos, updatedById: admin.userId },
      });
    }

    const partes = [
      c.recuadrosNuevos.length && `${c.recuadrosNuevos.length} recuadro(s) nuevo(s)`,
      c.recuadrosRenombrados.length && `${c.recuadrosRenombrados.length} renombrado(s)`,
      c.recuadrosEliminados.length && `${c.recuadrosEliminados.length} recuadro(s) eliminado(s)`,
      c.camposNuevos.length && `${c.camposNuevos.length} campo(s) nuevo(s)`,
      c.camposEditados.length && `${c.camposEditados.length} campo(s) editado(s)`,
      c.camposEliminados.length && `${c.camposEliminados.length} campo(s) quitado(s)`,
      `${Object.values(diseno).filter((a) => a.oculto).length} recuadro(s) oculto(s)`,
    ].filter(Boolean);
    resumen = partes.join(", ");
  });

  await logActivity({
    user: admin,
    accion: c.recuadrosEliminados.length || c.camposEliminados.length ? "ELIMINAR" : "EDITAR",
    entidad: "Diseño de ficha",
    resumen: `Editó la ficha técnica de ${apartado.nombre}`,
    detalle: resumen,
  });

  revalidatePath("/ciudades", "layout");
  revalidatePath("/admin/campos", "layout");
  return { ok: true, resumen };
}
