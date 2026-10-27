import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { EVENTOS_ACCESO, EVENTOS_DE_RIESGO, type EventoAcceso } from "./registro-acceso";
import { DURACION_MAXIMA_MS, INACTIVIDAD_MS } from "./sesion-vigencia";

// Consultas de la pestaña "Bitácora de acceso" (/admin/accesos) y de su
// descarga en Excel. Los filtros llegan por la URL.

export type FiltrosAcceso = {
  usuario?: string;
  evento?: EventoAcceso | "riesgo";
  desde?: string; // AAAA-MM-DD
  hasta?: string; // AAAA-MM-DD
  ip?: string;
};

export const POR_PAGINA = 100;

function fechaLocal(dia: string | undefined, finDelDia: boolean): Date | undefined {
  if (!dia || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return undefined;
  const [a, m, d] = dia.split("-").map(Number);
  return finDelDia ? new Date(a, m - 1, d, 23, 59, 59, 999) : new Date(a, m - 1, d);
}

export function leerFiltros(sp: Record<string, string | undefined>): FiltrosAcceso {
  const evento = sp.evento && (sp.evento === "riesgo" || sp.evento in EVENTOS_ACCESO) ? (sp.evento as FiltrosAcceso["evento"]) : undefined;
  return {
    usuario: sp.usuario?.trim() || undefined,
    evento,
    desde: sp.desde || undefined,
    hasta: sp.hasta || undefined,
    ip: sp.ip?.trim() || undefined,
  };
}

function where(f: FiltrosAcceso): Prisma.RegistroAccesoWhereInput {
  const desde = fechaLocal(f.desde, false);
  const hasta = fechaLocal(f.hasta, true);
  return {
    ...(f.usuario ? { username: f.usuario } : {}),
    ...(f.evento === "riesgo" ? { evento: { in: EVENTOS_DE_RIESGO } } : f.evento ? { evento: f.evento } : {}),
    ...(f.ip ? { ip: f.ip } : {}),
    ...(desde || hasta ? { createdAt: { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) } } : {}),
  };
}

export async function getRegistrosAcceso(f: FiltrosAcceso, pagina: number, limite = POR_PAGINA) {
  const w = where(f);
  const [registros, total] = await Promise.all([
    prisma.registroAcceso.findMany({ where: w, orderBy: { createdAt: "desc" }, skip: (pagina - 1) * limite, take: limite }),
    prisma.registroAcceso.count({ where: w }),
  ]);
  return { registros, total };
}

// Nombres que aparecen en la bitácora, para el filtro (incluye cuentas que
// ya no existen y usuarios inventados en intentos fallidos).
export async function getUsuariosDeLaBitacora(): Promise<string[]> {
  const filas = await prisma.registroAcceso.findMany({ distinct: ["username"], select: { username: true }, orderBy: { username: "asc" } });
  return filas.map((f) => f.username);
}

export async function getResumenAccesos() {
  const ahora = Date.now();
  const inicioDeHoy = new Date();
  inicioDeHoy.setHours(0, 0, 0, 0);
  const hace24h = new Date(ahora - 24 * 60 * 60 * 1000);
  const [iniciosHoy, fallidos24h, bloqueadas, sesiones] = await Promise.all([
    prisma.registroAcceso.count({ where: { evento: "INICIO_SESION", createdAt: { gte: inicioDeHoy } } }),
    prisma.registroAcceso.count({ where: { evento: { in: EVENTOS_DE_RIESGO }, createdAt: { gte: hace24h } } }),
    prisma.user.findMany({ where: { bloqueadoHasta: { gt: new Date() } }, select: { id: true, username: true, bloqueadoHasta: true } }),
    // Vivas = menos de 12 h desde que iniciaron Y con actividad en los
    // últimos 20 min. Las demás ya no sirven aunque la fila siga (navegador
    // cerrado, inactividad); se limpian solas.
    prisma.sesionActiva.findMany({
      where: {
        creadaEl: { gte: new Date(ahora - DURACION_MAXIMA_MS) },
        ultimaActividad: { gte: new Date(ahora - INACTIVIDAD_MS) },
      },
      include: { user: { select: { username: true, puesto: true } } },
      orderBy: { creadaEl: "desc" },
    }),
  ]);
  return { iniciosHoy, fallidos24h, bloqueadas, sesiones };
}
