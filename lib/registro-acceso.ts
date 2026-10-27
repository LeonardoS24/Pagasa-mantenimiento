import { headers } from "next/headers";
import { prisma } from "./prisma";

// Bitácora de acceso (tabla RegistroAcceso, pestaña /admin/accesos).

export const EVENTOS_ACCESO = {
  INICIO_SESION: "Inició sesión",
  INTENTO_FALLIDO: "Intento fallido",
  CUENTA_BLOQUEADA: "Cuenta bloqueada por intentos",
  CUENTA_DESBLOQUEADA: "Cuenta desbloqueada por el administrador",
  INTENTO_CUENTA_BLOQUEADA: "Intento con la cuenta bloqueada",
  BLOQUEO_POR_EQUIPO: "Bloqueado: muchos intentos desde un equipo",
  CIERRE_SESION: "Cerró sesión",
  CIERRE_INACTIVIDAD: "Sesión cerrada por inactividad",
  SESION_EXPIRADA: "Sesión vencida (12 h)",
  SESION_CERRADA_POR_ADMIN: "Sesión cerrada por el administrador",
  CAMBIO_CONTRASENA: "Cambió su contraseña",
  CONTRASENA_RESTABLECIDA: "Contraseña restablecida por el administrador",
  USUARIO_CREADO: "Cuenta creada",
  USUARIO_ELIMINADO: "Cuenta eliminada",
  CAMBIO_ROL: "Cambio de rol",
  CAMBIO_CIUDADES: "Cambio de ciudades con acceso",
  CAMBIO_ACCESO_AMPLIADO: "Cambio de acceso ampliado",
} as const;

export type EventoAcceso = keyof typeof EVENTOS_ACCESO;

// Eventos que el panel marca en rojo.
export const EVENTOS_DE_RIESGO: EventoAcceso[] = [
  "INTENTO_FALLIDO",
  "CUENTA_BLOQUEADA",
  "INTENTO_CUENTA_BLOQUEADA",
  "BLOQUEO_POR_EQUIPO",
];

// "Chrome 141 · Windows" a partir del user-agent: lo suficiente para
// reconocer "ese no fue mi equipo" sin guardar la cadena completa.
export function resumirNavegador(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const nav =
    /Edg\/(\d+)/.exec(ua)?.[1] ? `Edge ${/Edg\/(\d+)/.exec(ua)![1]}`
    : /OPR\/(\d+)/.exec(ua)?.[1] ? `Opera ${/OPR\/(\d+)/.exec(ua)![1]}`
    : /Firefox\/(\d+)/.exec(ua)?.[1] ? `Firefox ${/Firefox\/(\d+)/.exec(ua)![1]}`
    : /Chrome\/(\d+)/.exec(ua)?.[1] ? `Chrome ${/Chrome\/(\d+)/.exec(ua)![1]}`
    : /Version\/(\d+).*Safari/.exec(ua)?.[1] ? `Safari ${/Version\/(\d+).*Safari/.exec(ua)![1]}`
    : "Otro navegador";
  const so = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iPhone/iPad"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : "otro sistema";
  return `${nav} · ${so}`;
}

// IP y navegador de quien hace la petición. Next pone x-forwarded-for con la
// dirección real del equipo; "::ffff:" es cómo Node escribe una IPv4.
export function datosDelCliente(): { ip: string | null; navegador: string | null } {
  try {
    const h = headers();
    const ip = (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().replace(/^::ffff:/, "") || null;
    return { ip, navegador: resumirNavegador(h.get("user-agent")) };
  } catch {
    return { ip: null, navegador: null };
  }
}

// Nunca lanza: que falle la bitácora no debe impedir entrar ni cerrar sesión.
export async function registrarAcceso(params: {
  evento: EventoAcceso;
  username: string;
  userId?: string | null;
  actorUsername?: string | null;
  detalle?: string | null;
  cliente?: { ip: string | null; navegador: string | null };
}): Promise<void> {
  try {
    const cliente = params.cliente ?? datosDelCliente();
    await prisma.registroAcceso.create({
      data: {
        evento: params.evento,
        username: params.username.slice(0, 100),
        userId: params.userId ?? null,
        actorUsername: params.actorUsername ?? null,
        detalle: params.detalle ?? null,
        ip: cliente.ip,
        navegador: cliente.navegador,
      },
    });
  } catch (error) {
    console.error("[bitácora de acceso] No se pudo registrar:", error);
  }
}

// Intentos fallidos recientes desde una misma IP (para cortar a quien prueba
// muchos usuarios distintos, que el bloqueo por cuenta no detiene).
export async function intentosFallidosDesdeIp(ip: string, minutos: number): Promise<number> {
  return prisma.registroAcceso.count({
    where: {
      ip,
      evento: { in: ["INTENTO_FALLIDO", "INTENTO_CUENTA_BLOQUEADA"] },
      createdAt: { gte: new Date(Date.now() - minutos * 60 * 1000) },
    },
  });
}
