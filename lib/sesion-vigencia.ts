// Reglas de vigencia de la sesión. Sin Prisma ni APIs de Node a propósito: las
// usa el middleware (edge) además del servidor.

// Minutos sin actividad después de los cuales hay que volver a iniciar sesión.
export const INACTIVIDAD_MINUTOS = 20;
export const INACTIVIDAD_MS = INACTIVIDAD_MINUTOS * 60 * 1000;

// Tope absoluto: aunque la persona no deje de usarlo, a las 12 horas de haber
// iniciado (una jornada) se pide la contraseña otra vez.
export const DURACION_MAXIMA_MS = 12 * 60 * 60 * 1000;

// El middleware renueva la marca de actividad como mucho cada tanto, para no
// reescribir la cookie en cada petición.
export const RENOVAR_CADA_MS = 30 * 1000;

export type EstadoVigencia = "vigente" | "inactividad" | "expirada";

export function estadoDeVigencia(
  datos: { iniciadaEl?: number; ultimaActividad?: number },
  ahora: number = Date.now()
): EstadoVigencia {
  // Una cookie de antes de esta regla (sin marcas) no se puede dar por buena.
  if (!datos.iniciadaEl || !datos.ultimaActividad) return "expirada";
  if (ahora - datos.iniciadaEl > DURACION_MAXIMA_MS) return "expirada";
  if (ahora - datos.ultimaActividad > INACTIVIDAD_MS) return "inactividad";
  return "vigente";
}
