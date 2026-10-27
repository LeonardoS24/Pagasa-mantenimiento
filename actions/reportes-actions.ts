"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logActivity } from "@/lib/activity-log";
import { cifrarSecreto } from "@/lib/secretos";
import { normalizarUrlBase, setUrlBase } from "@/lib/ajustes";
import { DESTINATARIOS_MAX, enviarReporte, parsearDestinatarios } from "@/lib/reportes-programados";
import type { ActionState } from "./user-actions";

// Configuración del reporte semanal por correo y de la dirección del sistema.
// Solo ADMIN: manda información de toda la empresa a correos externos y
// guarda credenciales.
const entero = (min: number, max: number, mensaje: string) =>
  z.preprocess(
    (v) => (String(v ?? "").trim() === "" ? NaN : Number(v)),
    z.number({ invalid_type_error: mensaje }).int(mensaje).min(min, mensaje).max(max, mensaje)
  );

const opcional = (max: number) =>
  z.preprocess((v) => String(v ?? "").trim() || undefined, z.string().max(max, `Máximo ${max} caracteres`).optional());

const schema = z.object({
  activo: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  avisoRojoActivo: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  destinatarios: z.preprocess((v) => String(v ?? ""), z.string().max(3000)),
  diaSemana: entero(0, 6, "Elige el día de la semana"),
  hora: entero(0, 23, "La hora va de 0 a 23"),
  diasAnticipacion: entero(1, 365, "Los días de anticipación van de 1 a 365"),
  smtpHost: opcional(200),
  smtpPuerto: entero(1, 65535, "El puerto del servidor de correo va de 1 a 65535"),
  smtpSeguro: z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  smtpUsuario: opcional(200),
  smtpClave: z.preprocess((v) => String(v ?? ""), z.string().max(300)),
  remitente: opcional(200),
  urlBase: z.preprocess((v) => String(v ?? "").trim(), z.string().max(300)),
});

export async function guardarReportes(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  const { validos, invalidos } = parsearDestinatarios(d.destinatarios);
  if (invalidos.length > 0) return { error: `Correo no válido: ${invalidos.slice(0, 3).join(", ")}` };
  if (validos.length > DESTINATARIOS_MAX) return { error: `Máximo ${DESTINATARIOS_MAX} destinatarios.` };
  if (d.smtpHost && /[\s/]/.test(d.smtpHost)) {
    return { error: "El servidor de correo va solo como nombre, por ejemplo smtp.gmail.com" };
  }

  let urlBase: string | null = null;
  if (d.urlBase) {
    urlBase = normalizarUrlBase(d.urlBase);
    if (!urlBase) return { error: "La dirección del sistema debe empezar con http:// o https://, por ejemplo http://192.168.1.50:3000" };
  }

  const anterior = await prisma.configuracionReportes.findUnique({ where: { id: "unico" } });
  if (d.activo || d.avisoRojoActivo) {
    if (validos.length === 0) return { error: "Para activar el envío escribe al menos un destinatario." };
    const hayServidor = !!(d.smtpHost || process.env.SMTP_HOST);
    if (!hayServidor) return { error: "Para activar el envío captura el servidor de correo (SMTP)." };
  }

  // La contraseña nunca vuelve al navegador: en blanco = conservar la actual.
  const claveCifrada = d.smtpClave ? cifrarSecreto(d.smtpClave) : anterior?.smtpClaveCifrada ?? null;
  const datos = {
    activo: d.activo,
    avisoRojoActivo: d.avisoRojoActivo,
    destinatarios: validos.join("\n"),
    diaSemana: d.diaSemana,
    hora: d.hora,
    diasAnticipacion: d.diasAnticipacion,
    smtpHost: d.smtpHost ?? null,
    smtpPuerto: d.smtpPuerto,
    smtpSeguro: d.smtpSeguro,
    smtpUsuario: d.smtpUsuario ?? null,
    smtpClaveCifrada: claveCifrada,
    remitente: d.remitente ?? null,
    actualizadoPor: admin.username,
  };
  await prisma.configuracionReportes.upsert({
    where: { id: "unico" },
    update: datos,
    create: { id: "unico", ...datos },
  });
  await setUrlBase(urlBase);

  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Reportes por correo",
    resumen: d.activo ? "Envío activado" : "Envío desactivado",
    detalle: `${validos.length} destinatario(s) · servidor ${d.smtpHost ?? "del .env"}${d.smtpClave ? " · cambió la contraseña" : ""}`,
  });

  revalidatePath("/admin/reportes");
  return { success: d.activo ? "Guardado. El reporte se enviará automáticamente en el día y hora elegidos." : "Guardado. El envío automático está desactivado." };
}

// Manda el reporte ya, con lo último que se guardó: sirve de prueba.
export async function enviarReporteAhora(_prev: ActionState): Promise<ActionState> {
  const admin = await requireAdmin();
  const resultado = await enviarReporte("manual");
  await logActivity({
    user: admin,
    accion: "EDITAR",
    entidad: "Reportes por correo",
    resumen: "Envío manual",
    detalle: resultado.mensaje,
  });
  revalidatePath("/admin/reportes");
  return resultado.ok ? { success: resultado.mensaje } : { error: resultado.mensaje };
}
