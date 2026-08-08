import { prisma } from "./prisma";

// Acceso ampliado por horario: el ADMIN le configura a un USUARIO días de la
// semana + un rango de horas en los que puede editar/borrar registros y
// ficha técnica como si fuera ADMIN (ver lib/auth.ts: requireElevatedEditor).
// Nunca alcanza para borrar ciudades/apartados/usuarios ni cambiar roles —
// eso sigue exclusivo del rol ADMIN real, sin importar la hora.
export interface ElevatedAccessSchedule {
  dias: number[]; // 0 (domingo) .. 6 (sábado)
  horaInicio: string; // "HH:MM"
  horaFin: string; // "HH:MM"
}

export const DIA_LABELS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export function parseElevatedAccessSchedule(user: {
  accesoAmpliadoDias: string | null;
  accesoAmpliadoHoraInicio: string | null;
  accesoAmpliadoHoraFin: string | null;
}): ElevatedAccessSchedule | null {
  if (!user.accesoAmpliadoDias || !user.accesoAmpliadoHoraInicio || !user.accesoAmpliadoHoraFin) {
    return null;
  }
  try {
    const dias = JSON.parse(user.accesoAmpliadoDias);
    if (!Array.isArray(dias) || dias.length === 0) return null;
    if (!dias.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) return null;
    return { dias, horaInicio: user.accesoAmpliadoHoraInicio, horaFin: user.accesoAmpliadoHoraFin };
  } catch {
    return null;
  }
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// Hora local del servidor (no UTC): un horario de "8:00 a 17:00" debe leerse
// como la hora de pared del negocio, igual que cualquier reloj de oficina.
export function isWithinElevatedAccessWindow(
  schedule: ElevatedAccessSchedule,
  now: Date = new Date()
): boolean {
  if (!schedule.dias.includes(now.getDay())) return false;

  const inicio = minutesOfDay(schedule.horaInicio);
  const fin = minutesOfDay(schedule.horaFin);
  const actual = now.getHours() * 60 + now.getMinutes();

  if (inicio <= fin) {
    return actual >= inicio && actual <= fin;
  }
  // Horario que cruza medianoche (ej. 22:00 a 02:00).
  return actual >= inicio || actual <= fin;
}

// Para las páginas que deciden qué botones de ADMIN mostrar (editar completo,
// borrar, "Editar registro"): sin esto, requireElevatedEditor del lado del
// servidor dejaría hacer el cambio, pero el usuario nunca vería el botón
// para intentarlo. userId ya viene revalidado por requireUser, así que aquí
// solo hace falta leer el horario guardado.
export async function hasActiveElevatedAccess(userId: string): Promise<boolean> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { accesoAmpliadoDias: true, accesoAmpliadoHoraInicio: true, accesoAmpliadoHoraFin: true },
  });
  if (!dbUser) return false;
  const schedule = parseElevatedAccessSchedule(dbUser);
  return schedule !== null && isWithinElevatedAccessWindow(schedule);
}
