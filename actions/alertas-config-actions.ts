"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import {
  ALERTAS_DE_FABRICA,
  APARTADOS_PARA_ALERTAS,
  REGISTROS_PARA_ALERTAS,
  camposFechaDeFicha,
  esTipoDeFabrica,
} from "@/lib/alertas-catalogo";

// Administración → Alertas → Configurar alertas (ver lib/alertas-catalogo.ts).
// Solo ADMIN y todo con su contraseña: una alerta mueve los avisos de todas
// las ciudades. Cada cambio queda en la bitácora de actividad ("Alerta").

export type ResultadoAlerta = { ok: true; mensaje: string } | { ok: false; error: string };

const ENTIDAD = "Alerta";

function avisarCambio() {
  // Inicio, portadas de ciudad, calendario, tablero y avisos.
  revalidatePath("/", "layout");
}

const nombreSchema = z
  .string()
  .transform((v) => v.replace(/\s+/g, " ").trim())
  .pipe(z.string().min(3, "El nombre es muy corto.").max(120, "El nombre es muy largo (máximo 120 caracteres)."));

// ── Alertas de fábrica: renombrar, quitar y volver a poner ────────────────

export async function guardarAlertaDeFabrica(
  tipo: string,
  entrada: { nombre: string; activa: boolean },
  password: string
): Promise<ResultadoAlerta> {
  const admin = await requireAdmin();
  if (!esTipoDeFabrica(tipo)) return { ok: false, error: "Esa alerta no existe." };
  const base = ALERTAS_DE_FABRICA.find((a) => a.tipo === tipo)!;
  const nombre = nombreSchema.safeParse(entrada.nombre);
  if (!nombre.success) return { ok: false, error: nombre.error.issues[0]?.message ?? "Nombre inválido." };
  const activa = entrada.activa === true;

  const errorClave = await verifySessionPassword(admin, password);
  if (errorClave) return { ok: false, error: errorClave };

  const antes = await prisma.alertaAjuste.findUnique({ where: { tipo } });
  const nombreAntes = antes?.nombre || base.nombre;
  const activaAntes = antes?.activa ?? true;
  const cambios: string[] = [];
  if (nombreAntes !== nombre.data) cambios.push(`Nombre: ${nombreAntes} → ${nombre.data}`);
  if (activaAntes !== activa) cambios.push(activa ? "Se volvió a poner" : "Se quitó (ya no avisa)");
  if (cambios.length === 0) return { ok: true, mensaje: "No había cambios que guardar." };

  // Igual al de fábrica = sin fila.
  if (nombre.data === base.nombre && activa) {
    await prisma.alertaAjuste.deleteMany({ where: { tipo } });
  } else {
    const datos = { nombre: nombre.data === base.nombre ? null : nombre.data, activa, actualizadoPor: admin.username };
    await prisma.alertaAjuste.upsert({ where: { tipo }, update: datos, create: { tipo, ...datos } });
  }
  await logActivity({ user: admin, accion: activa ? "EDITAR" : "ELIMINAR", entidad: ENTIDAD, resumen: base.nombre, detalle: cambios.join(" · ") });
  avisarCambio();
  return { ok: true, mensaje: activa ? "Guardado." : "Alerta quitada: ya no sale en ningún lado. Puedes volver a ponerla cuando quieras." };
}

// ── Alertas agregadas ──────────────────────────────────────────────────────

const alertaSchema = z
  .object({
    nombre: nombreSchema,
    apartados: z.array(z.string()).min(1, "Elige al menos un apartado."),
    fuente: z.enum(["FICHA", "CAMPO", "REGISTRO"]),
    fuenteClave: z.string().min(1, "Elige de dónde sale la fecha.").max(80),
    modo: z.enum(["VENCE", "PLAZO"]),
    plazoAnios: z.number().int().min(0).max(50),
    plazoMeses: z.number().int().min(0).max(11),
    diasAviso: z.number().int().min(7, "El aviso debe ser de 7 días o más.").max(365, "El aviso máximo es de 365 días."),
    requisitoClave: z.string().max(80).nullable(),
    activa: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.modo === "PLAZO" && d.plazoAnios === 0 && d.plazoMeses === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Escribe cada cuánto vence (años o meses)." });
    }
    const validos = new Set(APARTADOS_PARA_ALERTAS.map((a) => a.slug));
    if (d.apartados.some((a) => !validos.has(a))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Hay un apartado que no existe." });
    }
  });

export type EntradaAlertaPropia = z.input<typeof alertaSchema>;

export async function guardarAlertaPropia(
  id: string | null,
  entrada: EntradaAlertaPropia,
  password: string
): Promise<ResultadoAlerta> {
  const admin = await requireAdmin();
  const parsed = alertaSchema.safeParse(entrada);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  // La fecha tiene que existir: campo de la ficha, registro o campo agregado
  // de tipo fecha.
  if (d.fuente === "FICHA" && !camposFechaDeFicha().some((c) => c.campo === d.fuenteClave)) {
    return { ok: false, error: "Ese campo de la ficha no existe." };
  }
  if (d.fuente === "REGISTRO" && !REGISTROS_PARA_ALERTAS.some((r) => r.clave === d.fuenteClave)) {
    return { ok: false, error: "Ese registro no existe." };
  }
  if (d.fuente === "CAMPO") {
    const campo = await prisma.customField.findUnique({ where: { id: d.fuenteClave } });
    if (!campo || campo.tipo !== "FECHA") return { ok: false, error: "Elige un campo agregado de tipo fecha." };
  }
  if (d.requisitoClave) {
    const existe = d.requisitoClave.startsWith("p-")
      ? await prisma.requisitoPropio.findUnique({ where: { id: d.requisitoClave.slice(2) } })
      : true;
    if (!existe) return { ok: false, error: "Ese término de referencia ya no existe." };
  }

  const errorClave = await verifySessionPassword(admin, password);
  if (errorClave) return { ok: false, error: errorClave };

  const datos = {
    nombre: d.nombre,
    apartados: JSON.stringify(d.apartados),
    fuente: d.fuente,
    fuenteClave: d.fuenteClave,
    modo: d.modo,
    plazoAnios: d.modo === "PLAZO" ? d.plazoAnios : 0,
    plazoMeses: d.modo === "PLAZO" ? d.plazoMeses : 0,
    diasAviso: d.diasAviso,
    requisitoClave: d.requisitoClave || null,
    activa: d.activa,
    actualizadoPor: admin.username,
  };
  const plazo = d.modo === "VENCE" ? "la fecha es el vencimiento" : `vence a los ${d.plazoAnios} año(s) y ${d.plazoMeses} mes(es)`;

  if (id) {
    const antes = await prisma.alertaPropia.findUnique({ where: { id } });
    if (!antes) return { ok: false, error: "Esa alerta ya no existe." };
    await prisma.alertaPropia.update({ where: { id }, data: datos });
    await logActivity({
      user: admin,
      accion: "EDITAR",
      entidad: ENTIDAD,
      resumen: d.nombre,
      detalle: `Editó la alerta agregada${antes.nombre !== d.nombre ? ` (antes «${antes.nombre}»)` : ""}: ${plazo}${d.activa ? "" : " · en pausa"}`,
    });
  } else {
    await prisma.alertaPropia.create({ data: { ...datos, creadoPor: admin.username } });
    await logActivity({ user: admin, accion: "EDITAR", entidad: ENTIDAD, resumen: d.nombre, detalle: `Agregó la alerta: ${plazo}` });
  }
  avisarCambio();
  return { ok: true, mensaje: id ? "Alerta guardada." : "Alerta agregada. Ya avisa en Inicio, en cada ciudad y en el calendario." };
}

export async function eliminarAlertaPropia(id: string, password: string): Promise<ResultadoAlerta> {
  const admin = await requireAdmin();
  const alerta = await prisma.alertaPropia.findUnique({ where: { id } });
  if (!alerta) return { ok: false, error: "Esa alerta ya no existe." };
  const errorClave = await verifySessionPassword(admin, password);
  if (errorClave) return { ok: false, error: errorClave };
  await prisma.alertaPropia.delete({ where: { id } });
  await logActivity({ user: admin, accion: "ELIMINAR", entidad: ENTIDAD, resumen: alerta.nombre, detalle: "Eliminó la alerta agregada (los datos de las unidades no se tocan)" });
  avisarCambio();
  return { ok: true, mensaje: "Alerta eliminada." };
}
