import { prisma } from "./prisma";

// Frenos contra adivinar contraseñas (login y "Mi contraseña").
//
// Los dos APARTAN el intento ANTES de comparar la contraseña. Si primero se
// comparara y después se contara, cien intentos mandados al mismo tiempo
// leerían todos el contador en cero (bcrypt cede el hilo mientras compara) y
// ninguno bloquearía.

export const MAX_INTENTOS_FALLIDOS = 5;
export const BLOQUEO_MINUTOS = 15;
export const MAX_POR_EQUIPO = 20;
export const VENTANA_EQUIPO_MINUTOS = 15;

// ----- Por cuenta (en la base: sobrevive reinicios) ------------------------

export type Reserva = { permitido: true; numero: number } | { permitido: false; bloqueadoHasta: Date };

export async function reservarIntentoDeCuenta(userId: string): Promise<Reserva> {
  const ahora = new Date();
  const actual = await prisma.user.findUnique({ where: { id: userId }, select: { bloqueadoHasta: true } });
  if (actual?.bloqueadoHasta && actual.bloqueadoHasta > ahora) return { permitido: false, bloqueadoHasta: actual.bloqueadoHasta };
  // Un bloqueo ya vencido empieza de cero.
  if (actual?.bloqueadoHasta) {
    await prisma.user.updateMany({ where: { id: userId, bloqueadoHasta: { lte: ahora } }, data: { bloqueadoHasta: null, intentosFallidosLogin: 0 } });
  }
  // increment es atómico en SQLite: cada intento simultáneo recibe su número.
  const { intentosFallidosLogin: numero } = await prisma.user.update({
    where: { id: userId },
    data: { intentosFallidosLogin: { increment: 1 } },
    select: { intentosFallidosLogin: true },
  });
  if (numero > MAX_INTENTOS_FALLIDOS) {
    const hasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000);
    await prisma.user.updateMany({ where: { id: userId, bloqueadoHasta: null }, data: { bloqueadoHasta: hasta } });
    return { permitido: false, bloqueadoHasta: hasta };
  }
  return { permitido: true, numero };
}

// Tras un fallo: si fue el último permitido, bloquea. Regresa si bloqueó.
export async function fallo(userId: string, numero: number): Promise<boolean> {
  if (numero < MAX_INTENTOS_FALLIDOS) return false;
  await prisma.user.update({ where: { id: userId }, data: { bloqueadoHasta: new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000) } });
  return true;
}

export async function acierto(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { intentosFallidosLogin: 0, bloqueadoHasta: null } });
}

// ----- Por equipo (en memoria: el sistema corre en un solo proceso) --------

const g = globalThis as unknown as { __frenoEquipo?: Map<string, number[]> };

function intentos(ip: string): number[] {
  g.__frenoEquipo ??= new Map();
  const limite = Date.now() - VENTANA_EQUIPO_MINUTOS * 60 * 1000;
  const lista = (g.__frenoEquipo.get(ip) ?? []).filter((t) => t > limite);
  g.__frenoEquipo.set(ip, lista);
  return lista;
}

// Aparta un intento del equipo; false = ya llegó al límite.
export function reservarIntentoDeEquipo(ip: string | null): boolean {
  if (!ip) return true;
  const lista = intentos(ip);
  if (lista.length >= MAX_POR_EQUIPO) return false;
  lista.push(Date.now());
  return true;
}

// Un inicio correcto no cuenta como intento fallido.
export function liberarIntentoDeEquipo(ip: string | null): void {
  if (!ip) return;
  intentos(ip).pop();
}
