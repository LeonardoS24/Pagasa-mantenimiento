import nodemailer from "nodemailer";
import type { ConfiguracionReportes } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAllRealCityIds } from "@/lib/aggregate-city";
import { getUrlBase } from "@/lib/ajustes";
import { descifrarSecreto } from "@/lib/secretos";
import { getVencimientos } from "@/lib/vencimientos";
import { armarReporte } from "@/lib/reporte-vencimientos";

// Envío del reporte de vencimientos por correo (configuración en
// /admin/reportes, tabla ConfiguracionReportes). Corre solo: scheduleReportes
// se arranca una vez desde instrumentation.ts y revisa cada 5 minutos si ya
// tocó el envío semanal.
export const DESTINATARIOS_MAX = 30;
const REVISAR_CADA_MS = 5 * 60 * 1000;
const REINTENTO_MS = 60 * 60 * 1000;
const VENTANA_RECUPERACION_MS = 24 * 60 * 60 * 1000;

export const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parsearDestinatarios(texto: string): { validos: string[]; invalidos: string[] } {
  const validos: string[] = [];
  const invalidos: string[] = [];
  for (const parte of texto.split(/[\s,;]+/).map((p) => p.trim()).filter(Boolean)) {
    if (!CORREO.test(parte)) invalidos.push(parte);
    else if (!validos.includes(parte.toLowerCase())) validos.push(parte.toLowerCase());
  }
  return { validos, invalidos };
}

// ----- Cuándo toca enviar -------------------------------------------------

// Último "día de la semana a tal hora" que ya pasó (hora local del servidor).
export function ultimoMomentoProgramado(ahora: Date, diaSemana: number, hora: number): Date {
  const momento = new Date(ahora);
  momento.setHours(hora, 0, 0, 0);
  momento.setDate(momento.getDate() - ((momento.getDay() - diaSemana + 7) % 7));
  if (momento.getTime() > ahora.getTime()) momento.setDate(momento.getDate() - 7);
  return momento;
}

export function proximoMomentoProgramado(ahora: Date, diaSemana: number, hora: number): Date {
  const ultimo = ultimoMomentoProgramado(ahora, diaSemana, hora);
  const siguiente = new Date(ultimo);
  siguiente.setDate(siguiente.getDate() + 7);
  return siguiente;
}

type Programacion = Pick<
  ConfiguracionReportes,
  "activo" | "destinatarios" | "diaSemana" | "hora" | "ultimoEnvio" | "ultimoIntento"
>;

// Se envía si ya pasó el momento de esta semana y todavía no se mandó, pero
// solo dentro de las 24 h siguientes: si el servidor estuvo apagado y vuelve
// días después, no manda un reporte viejo. Si el intento falló, se reintenta
// a la hora (no cada 5 minutos).
export function debeEnviarse(config: Programacion | null, ahora: Date): boolean {
  if (!config?.activo || parsearDestinatarios(config.destinatarios).validos.length === 0) return false;
  const momento = ultimoMomentoProgramado(ahora, config.diaSemana, config.hora);
  if (ahora.getTime() - momento.getTime() > VENTANA_RECUPERACION_MS) return false;
  if (config.ultimoEnvio && config.ultimoEnvio.getTime() >= momento.getTime()) return false;
  if (
    config.ultimoIntento &&
    config.ultimoIntento.getTime() >= momento.getTime() &&
    ahora.getTime() - config.ultimoIntento.getTime() < REINTENTO_MS
  ) {
    return false;
  }
  return true;
}

// ----- Servidor de correo -------------------------------------------------

export type Smtp = { host: string; puerto: number; seguro: boolean; usuario: string | null; clave: string | null; remitente: string | null };

// Lo capturado en el panel manda; si no hay servidor ahí, se usan las
// variables SMTP_* del .env del servidor.
export function smtpEfectivo(config: ConfiguracionReportes | null): Smtp | null {
  if (config?.smtpHost) {
    return {
      host: config.smtpHost,
      puerto: config.smtpPuerto,
      seguro: config.smtpSeguro,
      usuario: config.smtpUsuario,
      clave: descifrarSecreto(config.smtpClaveCifrada),
      remitente: config.remitente,
    };
  }
  if (process.env.SMTP_HOST) {
    const puerto = Number(process.env.SMTP_PORT ?? 465);
    return {
      host: process.env.SMTP_HOST,
      puerto,
      seguro: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : puerto === 465,
      usuario: process.env.SMTP_USER ?? null,
      clave: process.env.SMTP_PASS ?? null,
      remitente: process.env.SMTP_FROM ?? config?.remitente ?? null,
    };
  }
  return null;
}

// El transporte de nodemailer con las reglas del sistema (lo usa también el
// aviso de lo que pasa a rojo, lib/aviso-rojo.ts).
export function crearTransporte(smtp: Smtp) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.puerto,
    secure: smtp.seguro,
    // Con STARTTLS, no mandar la contraseña si el servidor no cifra.
    requireTLS: !smtp.seguro && !!smtp.usuario,
    auth: smtp.usuario ? { user: smtp.usuario, pass: smtp.clave! } : undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

export function explicarError(error: unknown): string {
  const e = error as { code?: string; responseCode?: number; message?: string };
  if (e.code === "EAUTH" || e.responseCode === 535) {
    return "El servidor rechazó el usuario o la contraseña. En Gmail hay que usar una contraseña de aplicación (no la contraseña normal de la cuenta).";
  }
  if (["ECONNECTION", "ETIMEDOUT", "ESOCKET", "ECONNREFUSED", "ENOTFOUND", "EDNS"].includes(e.code ?? "")) {
    return `No se pudo conectar al servidor de correo (${e.code}). Revisa el servidor y el puerto, y que el servidor del sistema tenga salida a internet.`;
  }
  return e.message ?? "Error desconocido al enviar el correo.";
}

export type ResultadoEnvio = { ok: boolean; mensaje: string };

// Manda el reporte ahora mismo. `motivo` cambia lo que se anota en el último
// resumen y si cuenta como el envío automático de la semana (y su reintento).
export async function enviarReporte(motivo: "programado" | "manual"): Promise<ResultadoEnvio> {
  const config = await prisma.configuracionReportes.findUnique({ where: { id: "unico" } });
  // Solo el envío automático cuenta como "intento" (ver debeEnviarse): una
  // prueba manual, buena o mala, no debe retrasar ni adelantar el de la semana.
  const registrar = (datos: Partial<ConfiguracionReportes>) => {
    const conIntento = motivo === "programado" ? { ultimoIntento: new Date(), ...datos } : datos;
    return prisma.configuracionReportes.upsert({
      where: { id: "unico" },
      update: conIntento,
      create: { id: "unico", ...conIntento },
    });
  };

  const { validos } = parsearDestinatarios(config?.destinatarios ?? "");
  if (validos.length === 0) {
    return { ok: false, mensaje: "No hay destinatarios: escribe al menos un correo." };
  }
  const smtp = smtpEfectivo(config);
  if (!smtp) {
    return { ok: false, mensaje: "Falta el servidor de correo (SMTP): captúralo en esta página." };
  }
  if (smtp.usuario && !smtp.clave) {
    const mensaje = "No se pudo abrir la contraseña guardada (¿cambió SESSION_SECRET?). Vuelve a escribirla y guarda.";
    await registrar({ ultimoError: mensaje });
    return { ok: false, mensaje };
  }

  try {
    const cityIds = await getAllRealCityIds();
    const reporte = armarReporte(await getVencimientos(cityIds), {
      dias: config?.diasAnticipacion ?? 30,
      urlBase: await getUrlBase(),
    });
    const transporte = crearTransporte(smtp);
    await transporte.sendMail({
      from: smtp.remitente || smtp.usuario || "pagasa@localhost",
      to: validos,
      subject: reporte.asunto,
      text: reporte.texto,
      html: reporte.html,
    });
    const resumen = `${motivo === "manual" ? "Envío manual" : "Envío automático"}: ${reporte.vencidos} vencido(s), ${reporte.proximos} próximo(s) · ${validos.length} destinatario(s)`;
    await registrar({
      ...(motivo === "programado" ? { ultimoEnvio: new Date() } : {}),
      ultimoError: null,
      ultimoResumen: resumen,
    });
    return { ok: true, mensaje: `Enviado a ${validos.length} destinatario(s): ${reporte.vencidos} vencido(s) y ${reporte.proximos} próximo(s).` };
  } catch (error) {
    const mensaje = explicarError(error);
    await registrar({ ultimoError: mensaje });
    return { ok: false, mensaje };
  }
}

// ----- Programador --------------------------------------------------------

let enCurso = false;

export async function revisarReporteProgramado(ahora: Date = new Date()): Promise<void> {
  if (enCurso) return;
  enCurso = true;
  try {
    const config = await prisma.configuracionReportes.findUnique({ where: { id: "unico" } });
    if (debeEnviarse(config, ahora)) {
      const resultado = await enviarReporte("programado");
      console.log(`[reportes] ${resultado.ok ? "Enviado" : "Falló"}: ${resultado.mensaje}`);
    }
    // Aviso diario de lo que pasó a rojo (ver lib/aviso-rojo.ts).
    const { revisarAvisoRojo } = await import("./aviso-rojo");
    await revisarAvisoRojo(ahora);
  } catch (error) {
    console.error("[reportes] Falló la revisión del reporte programado:", error);
  } finally {
    enCurso = false;
  }
}

// Se llama una sola vez al arrancar el servidor (ver instrumentation.ts).
// globalThis y no una variable del módulo, por lo mismo que lib/plazos.ts:
// Next empaqueta el archivo varias veces.
export function scheduleReportes(): void {
  const g = globalThis as Record<string, unknown>;
  if (g.__pagasaReportesAgendados) return;
  g.__pagasaReportesAgendados = true;
  setTimeout(() => void revisarReporteProgramado(), 60_000);
  setInterval(() => void revisarReporteProgramado(), REVISAR_CADA_MS);
}
