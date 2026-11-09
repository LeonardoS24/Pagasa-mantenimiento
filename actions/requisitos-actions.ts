"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { REQUISITOS_BASE, plazoBaseDe } from "@/lib/requisitos-normativos";
import { CLAVE_NORMAS_VIGENTES, cargarPlazos, getNormasVigentes, leerNormasVigentes } from "@/lib/requisitos-runtime";
import { verifySessionPassword } from "@/lib/reauth";
import type { ActionState } from "./user-actions";

// Ajustes al catálogo de requisitos normativos (ver
// lib/requisitos-normativos.ts). Solo ADMIN: el plazo mueve las alertas de
// todas las ciudades.
const texto = (max: number) =>
  z.preprocess((v) => String(v ?? "").replace(/\s+/g, " ").trim(), z.string().min(1, "No puede ir vacío").max(max));

const textoOpcional = (max: number) =>
  z.preprocess((v) => (v === null || v === undefined ? undefined : String(v).replace(/[ \t]+/g, " ").trim()), z.string().max(max).optional());

const schema = z.object({
  nombre: textoOpcional(150),
  aplicaA: textoOpcional(200),
  cuentaDesde: textoOpcional(150),
  nota: textoOpcional(1500),
  norma: texto(150),
  numeral: texto(150),
  cita: z.preprocess((v) => String(v ?? "").replace(/[ \t]+/g, " ").trim(), z.string().min(1, "La cita no puede ir vacía").max(1500)),
  verificado: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  plazoAnios: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? undefined : Number(v)),
    z.number({ invalid_type_error: "El plazo debe ser un número" }).int("El plazo debe ser en años enteros").min(1, "El plazo mínimo es 1 año").max(30, "El plazo máximo es 30 años").optional()
  ),
});

export async function guardarRequisito(clave: string, _prevState: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  if (clave.startsWith("p-")) return guardarRequisitoPropio(clave.slice(2), formData, admin);

  const base = REQUISITOS_BASE.find((r) => r.clave === clave);
  if (!base) return { error: "Ese requisito no existe en el catálogo." };

  const parsed = schema.safeParse({
    nombre: formData.get("nombre"),
    aplicaA: formData.get("aplicaA"),
    cuentaDesde: formData.get("cuentaDesde"),
    nota: formData.get("nota"),
    norma: formData.get("norma"),
    numeral: formData.get("numeral"),
    cita: formData.get("cita"),
    verificado: formData.get("verificado"),
    plazoAnios: formData.get("plazoAnios"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  // El plazo solo se edita en los requisitos que mueven una alerta: uno de
  // solo referencia no tiene plazo, aunque llegara en el FormData.
  const plazoBase = plazoBaseDe(base);
  if (base.plazoClave && d.plazoAnios === undefined) return { error: "Escribe el plazo en años." };

  // Se guarda solo lo que cambió respecto al catálogo base; un campo igual al
  // base queda en null (usa el base) para que "restablecer" y "ajustado"
  // signifiquen lo que dicen.
  const distinto = <T,>(valor: T, valorBase: T) => (valor === valorBase ? null : valor);
  // Nombre y textos: vacío = el del catálogo.
  const textoDe = (valor: string | undefined, valorBase: string | undefined) => (valor ? distinto(valor, valorBase ?? "") : null);
  const datos = {
    nombre: textoDe(d.nombre, base.nombre),
    aplicaA: textoDe(d.aplicaA, base.aplicaA),
    cuentaDesde: textoDe(d.cuentaDesde, base.cuentaDesde),
    nota: d.nota === undefined ? null : textoDe(d.nota, base.nota),
    plazoAnios: base.plazoClave ? distinto(d.plazoAnios as number, plazoBase) : null,
    norma: distinto(d.norma, base.norma),
    numeral: distinto(d.numeral, base.numeral),
    cita: distinto(d.cita, base.cita),
    verificado: distinto(d.verificado, base.verificado),
  };
  const sinCambios = Object.values(datos).every((v) => v === null);

  const anterior = await prisma.requisitoNormativoAjuste.findUnique({ where: { clave } });

  // Qué cambió respecto a lo que regía hasta ahora (no respecto al base):
  // queda en el historial de /admin/normas con fecha y quién, para poder
  // decir qué criterio aplicaba el sistema en cada momento.
  const antes = {
    nombre: anterior?.nombre ?? base.nombre,
    aplicaA: anterior?.aplicaA ?? base.aplicaA,
    cuentaDesde: anterior?.cuentaDesde ?? base.cuentaDesde,
    nota: anterior?.nota ?? base.nota ?? "",
    plazo: base.plazoClave ? anterior?.plazoAnios ?? plazoBase : null,
    norma: anterior?.norma ?? base.norma,
    numeral: anterior?.numeral ?? base.numeral,
    cita: anterior?.cita ?? base.cita,
    verificado: anterior?.verificado ?? base.verificado,
  };
  const cambios: string[] = [];
  if (d.nombre && antes.nombre !== d.nombre) cambios.push(`Nombre: ${antes.nombre} → ${d.nombre}`);
  if (d.aplicaA && antes.aplicaA !== d.aplicaA) cambios.push(`Aplica a: ${d.aplicaA}`);
  if (d.cuentaDesde && antes.cuentaDesde !== d.cuentaDesde) cambios.push(`Se cuenta desde: ${d.cuentaDesde}`);
  if (d.nota !== undefined && antes.nota !== d.nota) cambios.push(`Nota: «${d.nota}»`);
  if (base.plazoClave && antes.plazo !== d.plazoAnios) cambios.push(`Plazo: ${antes.plazo} → ${d.plazoAnios} años`);
  if (antes.norma !== d.norma) cambios.push(`Norma: ${antes.norma} → ${d.norma}`);
  if (antes.numeral !== d.numeral) cambios.push(`Numeral: ${antes.numeral} → ${d.numeral}`);
  if (antes.cita !== d.cita) cambios.push(`Cita: «${d.cita}»`);
  if (antes.verificado !== d.verificado) cambios.push(d.verificado ? "Marcado como cotejado" : "Marcado como pendiente de cotejar");
  if (cambios.length === 0) return { success: "No había cambios que guardar." };

  if (sinCambios && !anterior?.oculto) {
    if (anterior) await prisma.requisitoNormativoAjuste.delete({ where: { clave } });
  } else {
    await prisma.requisitoNormativoAjuste.upsert({
      where: { clave },
      update: { ...datos, actualizadoPor: admin.username },
      create: { clave, ...datos, actualizadoPor: admin.username },
    });
  }

  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Requisito normativo",
    resumen: d.nombre || base.nombre,
    detalle: cambios.join(" · "),
  });

  // Las alertas toman el plazo nuevo desde ya, en todas las pantallas.
  await cargarPlazos();
  revalidatePath("/", "layout");
  return { success: "Guardado. Las alertas ya usan este plazo." };
}

export async function restablecerRequisito(clave: string, _prevState: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  const base = REQUISITOS_BASE.find((r) => r.clave === clave);
  if (!base) return { error: "Ese requisito no existe en el catálogo." };

  await prisma.requisitoNormativoAjuste.deleteMany({ where: { clave } });
  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Requisito normativo",
    resumen: base.nombre,
    detalle: "Restableció los valores base del catálogo",
  });
  await cargarPlazos();
  revalidatePath("/", "layout");
  return { success: "Restablecido a los valores base." };
}

// ── Términos de referencia agregados por el ADMIN (tabla RequisitoPropio) ──

export type ResultadoCatalogo = { ok: true; mensaje: string } | { ok: false; error: string };

const propioSchema = z.object({
  nombre: texto(150),
  aplicaA: texto(200),
  norma: texto(150),
  numeral: texto(150),
  cita: z.preprocess((v) => String(v ?? "").replace(/[ \t]+/g, " ").trim(), z.string().min(1, "Escribe lo que dice la norma").max(1500)),
  cuentaDesde: z.preprocess((v) => String(v ?? "").replace(/\s+/g, " ").trim() || "—", z.string().max(150)),
  nota: z.preprocess((v) => String(v ?? "").replace(/[ \t]+/g, " ").trim(), z.string().max(1500)),
  verificado: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  plazoAnios: z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? null : Number(v)),
    z.number({ invalid_type_error: "El plazo debe ser un número" }).int("El plazo debe ser en años enteros").min(1).max(50).nullable()
  ),
});

function leerPropio(formData: FormData) {
  return propioSchema.safeParse({
    nombre: formData.get("nombre"),
    aplicaA: formData.get("aplicaA"),
    norma: formData.get("norma"),
    numeral: formData.get("numeral"),
    cita: formData.get("cita"),
    cuentaDesde: formData.get("cuentaDesde"),
    nota: formData.get("nota"),
    verificado: formData.get("verificado"),
    plazoAnios: formData.get("plazoAnios"),
  });
}

async function guardarRequisitoPropio(
  id: string,
  formData: FormData,
  admin: Awaited<ReturnType<typeof requireAdmin>>
): Promise<ActionState> {
  const antes = await prisma.requisitoPropio.findUnique({ where: { id } });
  if (!antes) return { error: "Ese término de referencia ya no existe." };
  const parsed = leerPropio(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  await prisma.requisitoPropio.update({ where: { id }, data: { ...d, nota: d.nota || null, actualizadoPor: admin.username } });
  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Requisito normativo",
    resumen: d.nombre,
    detalle: `Editó el término de referencia agregado${antes.nombre !== d.nombre ? ` (antes «${antes.nombre}»)` : ""}: ${d.norma}, ${d.numeral}`,
  });
  revalidatePath("/", "layout");
  return { success: "Guardado." };
}

export async function agregarRequisito(formData: FormData): Promise<ResultadoCatalogo> {
  const admin = await requireAdmin();
  const parsed = leerPropio(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const errorClave = await verifySessionPassword(admin, formData.get("password"));
  if (errorClave) return { ok: false, error: errorClave };
  const d = parsed.data;
  await prisma.requisitoPropio.create({
    data: { ...d, nota: d.nota || null, creadoPor: admin.username, actualizadoPor: admin.username },
  });
  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Requisito normativo",
    resumen: d.nombre,
    detalle: `Agregó el término de referencia: ${d.norma}, ${d.numeral}`,
  });
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Término de referencia agregado." };
}

// Quitar: uno agregado se borra; uno del catálogo se marca «quitado» (se
// puede volver a poner y su plazo, si mueve una alerta, sigue igual: para
// apagar la alerta está Alertas → Configurar alertas).
export async function quitarRequisito(clave: string, password: string): Promise<ResultadoCatalogo> {
  const admin = await requireAdmin();
  const errorClave = await verifySessionPassword(admin, password);
  if (errorClave) return { ok: false, error: errorClave };

  if (clave.startsWith("p-")) {
    const propio = await prisma.requisitoPropio.findUnique({ where: { id: clave.slice(2) } });
    if (!propio) return { ok: false, error: "Ese término de referencia ya no existe." };
    await prisma.$transaction([
      // Las alertas agregadas que lo citaban se quedan sin fundamento.
      prisma.alertaPropia.updateMany({ where: { requisitoClave: clave }, data: { requisitoClave: null } }),
      prisma.requisitoPropio.delete({ where: { id: propio.id } }),
    ]);
    await logActivity({
      user: admin,
      accion: "ELIMINAR",
      entidad: "Requisito normativo",
      resumen: propio.nombre,
      detalle: `Eliminó el término de referencia agregado (${propio.norma}, ${propio.numeral})`,
    });
  } else {
    const base = REQUISITOS_BASE.find((r) => r.clave === clave);
    if (!base) return { ok: false, error: "Ese requisito no existe en el catálogo." };
    await prisma.requisitoNormativoAjuste.upsert({
      where: { clave },
      update: { oculto: true, actualizadoPor: admin.username },
      create: { clave, oculto: true, actualizadoPor: admin.username },
    });
    await logActivity({
      user: admin,
      accion: "ELIMINAR",
      entidad: "Requisito normativo",
      resumen: base.nombre,
      detalle: "Lo quitó del catálogo (se puede volver a poner)",
    });
  }
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Quitado." };
}

export async function reponerRequisito(clave: string, password: string): Promise<ResultadoCatalogo> {
  const admin = await requireAdmin();
  const base = REQUISITOS_BASE.find((r) => r.clave === clave);
  if (!base) return { ok: false, error: "Ese requisito no existe en el catálogo." };
  const errorClave = await verifySessionPassword(admin, password);
  if (errorClave) return { ok: false, error: errorClave };
  const fila = await prisma.requisitoNormativoAjuste.findUnique({ where: { clave } });
  if (fila) {
    const soloQuitado = [
      fila.plazoAnios,
      fila.norma,
      fila.numeral,
      fila.cita,
      fila.verificado,
      fila.nombre,
      fila.aplicaA,
      fila.cuentaDesde,
      fila.nota,
    ].every((v) => v === null);
    if (soloQuitado) await prisma.requisitoNormativoAjuste.delete({ where: { clave } });
    else await prisma.requisitoNormativoAjuste.update({ where: { clave }, data: { oculto: false, actualizadoPor: admin.username } });
  }
  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Requisito normativo",
    resumen: base.nombre,
    detalle: "Lo volvió a poner en el catálogo",
  });
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Se volvió a poner." };
}

// ── Normas que rigen cada área (lista completa, ver getNormasVigentes) ─────

export type NormaVigenteEntrada = { clave: string; area: string; norma: string; detalle: string; vigenteHasta: string };

export async function guardarNormasVigentes(lista: NormaVigenteEntrada[], password: string): Promise<ResultadoCatalogo> {
  const admin = await requireAdmin();
  if (!Array.isArray(lista) || lista.length > 60) return { ok: false, error: "Lista inválida." };
  const limpia = lista.map((n, i) => {
    const vigenteHasta = String(n.vigenteHasta ?? "").trim();
    return {
      clave: String(n.clave || `p-${Date.now().toString(36)}-${i}`).slice(0, 60),
      area: String(n.area ?? "").replace(/\s+/g, " ").trim(),
      norma: String(n.norma ?? "").replace(/\s+/g, " ").trim(),
      detalle: String(n.detalle ?? "").replace(/[ \t]+/g, " ").trim(),
      ...(vigenteHasta ? { vigenteHasta } : {}),
    };
  });
  for (const n of limpia) {
    if (!n.area) return { ok: false, error: "Cada norma necesita el área que rige." };
    if (!n.norma) return { ok: false, error: `Escribe la norma de «${n.area}».` };
  }
  const texto = JSON.stringify(limpia);
  if (!leerNormasVigentes(texto)) {
    return { ok: false, error: "Revisa los datos: hay un texto muy largo o una fecha inválida." };
  }
  const claves = new Set(limpia.map((n) => n.clave));
  if (claves.size !== limpia.length) return { ok: false, error: "Hay dos normas con la misma clave." };

  const errorClave = await verifySessionPassword(admin, password);
  if (errorClave) return { ok: false, error: errorClave };

  const antes = await getNormasVigentes();
  const cambios: string[] = [];
  for (const n of limpia) {
    const a = antes.find((x) => x.clave === n.clave);
    if (!a) cambios.push(`Agregó: ${n.area} — ${n.norma}`);
    else if (a.area !== n.area || a.norma !== n.norma || a.detalle !== n.detalle || (a.vigenteHasta ?? "") !== (n.vigenteHasta ?? "")) {
      cambios.push(`Cambió: ${n.area} — ${a.norma !== n.norma ? `${a.norma} → ${n.norma}` : n.norma}`);
    }
  }
  for (const a of antes) if (!claves.has(a.clave)) cambios.push(`Quitó: ${a.area} — ${a.norma}`);
  if (cambios.length === 0) return { ok: true, mensaje: "No había cambios que guardar." };

  await prisma.ajusteSistema.upsert({
    where: { clave: CLAVE_NORMAS_VIGENTES },
    update: { valor: texto },
    create: { clave: CLAVE_NORMAS_VIGENTES, valor: texto },
  });
  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Requisito normativo",
    resumen: "Normas que rigen hoy",
    detalle: cambios.join(" · "),
  });
  revalidatePath("/", "layout");
  return { ok: true, mensaje: "Normas guardadas." };
}
