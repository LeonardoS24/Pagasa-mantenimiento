import { daysUntil } from "./ultrasound-alerts";
import { ANIOS_VALVULAS_OTRAS_UNIDADES, plazosActivos } from "./plazos";

// Alerta de cambio de válvulas: vence a los 5 años de fabricación de la más
// antigua de todo el juego (10 años en Auto-Tanques, ver
// aniosVigenciaValvulas). Mismo esquema amarillo/rojo que el ultrasonido.
// fechaFabricacionValvulaMaximoLlenado85 solo aplica si tieneValvulaMaximoLlenado85
// es true (no todas las unidades tienen esa válvula); si es null simplemente
// no participa en el cálculo, igual que cualquier otra fecha vacía.
export type ValveAlertLevel = "none" | "yellow" | "red";

export type ValveDates = {
  fechaFabricacionValvulaLlenado: Date | null | undefined;
  fechaFabricacionValvulaNoRetroceso: Date | null | undefined;
  fechaFabricacionValvulaBypass: Date | null | undefined;
  fechaFabricacionValvulaRetornoVapores: Date | null | undefined;
  fechaFabricacionValvulaServicio: Date | null | undefined;
  fechaFabricacionValvulaMaximoLlenado: Date | null | undefined;
  fechaFabricacionValvulaMaximoLlenado85: Date | null | undefined;
  fechaFabricacionValvulaAlivio: Date | null | undefined;
  fechaFabricacionValvulaDescargaEmergencia: Date | null | undefined;
  // Solo tanque de carga (Auto-Tanques y Semirremolques). Opcionales en el
  // tipo para no obligar a cada llamador que arma estas fechas a mano.
  fechaFabricacionValvulaExcesoFlujo?: Date | null | undefined;
  fechaFabricacionValvulaCheckLock?: Date | null | undefined;
};

export const valveLabels: Record<keyof ValveDates, string> = {
  fechaFabricacionValvulaLlenado: "Válvula de llenado",
  fechaFabricacionValvulaNoRetroceso: "Válvula de no retroceso (check)",
  fechaFabricacionValvulaBypass: "Válvula de bypass",
  fechaFabricacionValvulaRetornoVapores: "Válvula de retorno de vapores",
  fechaFabricacionValvulaServicio: "Válvula de servicio de vapor",
  fechaFabricacionValvulaMaximoLlenado: "Válvula de máximo llenado 90%",
  fechaFabricacionValvulaMaximoLlenado85: "Válvula de máximo llenado 85% (opcional)",
  fechaFabricacionValvulaAlivio: "Válvula de alivio (seguridad)",
  fechaFabricacionValvulaDescargaEmergencia: "Válvula de descarga de emergencia",
  fechaFabricacionValvulaExcesoFlujo: "Válvula de exceso de flujo (litrómetro)",
  fechaFabricacionValvulaCheckLock: "Válvula check lock",
};

// Saca de una ficha técnica (o de cualquier objeto con estos campos) todas
// las fechas que entran a la alerta. Antes cada pantalla armaba el objeto a
// mano campo por campo; con una válvula nueva había que acordarse de
// agregarla en todos lados o la alerta quedaba distinta según dónde se viera.
export function valveDatesFromSheet(
  sheet: { [K in keyof ValveDates]?: Date | null } | null | undefined
): ValveDates {
  const dates = {} as ValveDates;
  for (const key of Object.keys(valveLabels) as (keyof ValveDates)[]) {
    dates[key] = sheet?.[key] ?? null;
  }
  return dates;
}

// Vida máxima de las válvulas desde su fabricación, según el tipo de unidad.
// Los plazos viven en el catálogo de requisitos normativos (ver
// lib/requisitos-normativos.ts) y el ADMIN los edita desde /admin/normas; aquí
// solo se decide a cuál de ellos corresponde cada apartado:
// - Auto-Tanques y Semirremolques: válvulas del tanque de carga (base 10 años,
//   NOM-EM-008-ASEA-2026, Tabla 3).
// - Vehículo con tanque de carburación: base 5 años (NOM-005-SESH-2010, 9.6.4).
// - Cualquier otra unidad: 5 años fijos.
// Estaciones y Planta tienen su propia regla (ver lib/station-valves.ts y
// lib/planta-tank-instruments.ts).
//
// Ojo: la norma fija el plazo del tanque de carga a 4 válvulas; la alerta lo
// aplica a todo el juego (así se pidió).
export function aniosVigenciaValvulas(sectionSlug: string | null | undefined): number {
  const plazos = plazosActivos();
  if (sectionSlug === "auto-tanques" || sectionSlug === "semirremolques") return plazos.valvulasTanqueCarga;
  if (sectionSlug === "vehiculo-con-tanque-de-carburacion") return plazos.valvulasCarburacion;
  return ANIOS_VALVULAS_OTRAS_UNIDADES;
}

// Cómo se agrupan las alertas de válvulas de unidad en pantalla: el tanque de
// carga (Auto-Tanques y Semirremolques) va aparte del tanque de carburación
// del vehículo, porque son sistemas distintos con plazo distinto. Cualquier
// otra unidad que llegara a tener válvulas capturadas va en "otras".
export type GrupoValvulas = "tanque-de-carga" | "carburacion" | "otras";

export function grupoValvulasDeApartado(sectionSlug: string): GrupoValvulas {
  if (sectionSlug === "auto-tanques" || sectionSlug === "semirremolques") return "tanque-de-carga";
  if (sectionSlug === "vehiculo-con-tanque-de-carburacion") return "carburacion";
  return "otras";
}

function addYears(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

// Encuentra la válvula con la fecha de fabricación más antigua (la que
// primero vence). Regresa null si no hay ninguna fecha capturada.
export function oldestValve(
  dates: ValveDates
): { key: keyof ValveDates; fecha: Date } | null {
  let oldest: { key: keyof ValveDates; fecha: Date } | null = null;
  for (const key of Object.keys(valveLabels) as (keyof ValveDates)[]) {
    const fecha = dates[key];
    if (fecha && (!oldest || fecha.getTime() < oldest.fecha.getTime())) {
      oldest = { key, fecha };
    }
  }
  return oldest;
}

export function getValveVencimiento(dates: ValveDates, anios: number = ANIOS_VALVULAS_OTRAS_UNIDADES): Date | null {
  const oldest = oldestValve(dates);
  return oldest ? addYears(oldest.fecha, anios) : null;
}

export function getValveAlertLevel(dates: ValveDates, anios: number = ANIOS_VALVULAS_OTRAS_UNIDADES): ValveAlertLevel {
  const vencimiento = getValveVencimiento(dates, anios);
  if (!vencimiento) return "none";
  const daysLeft = daysUntil(vencimiento);
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "yellow";
  return "none";
}

// Las válvulas de un tanque de gas son la pieza más delicada de toda la
// ficha técnica: esta alerta se ve deliberadamente más fuerte que las demás
// (colores sólidos y saturados, no los tonos pálidos bg-X-100 del resto) para
// que nunca se confunda con una alerta cualquiera ni se pase por alto.
export const valveAlertBadgeStyles: Record<ValveAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-400 text-yellow-950 border border-yellow-600 font-bold",
  red: "bg-red-600 text-white border border-red-700 font-bold",
};

export const valveAlertRowStyles: Record<ValveAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-200",
  red: "bg-red-200",
};

export function valveAlertLabel(level: ValveAlertLevel, vencimiento: Date): string {
  if (level === "none") return "";
  const daysLeft = daysUntil(vencimiento);
  if (level === "red") {
    if (daysLeft < 0) return `Cambio de válvulas vencido hace ${Math.abs(daysLeft)} día(s)`;
    if (daysLeft === 0) return "Cambio de válvulas vence hoy";
    return `Faltan ${daysLeft} día(s) para el cambio de válvulas`;
  }
  return `Faltan ${daysLeft} día(s) para el cambio de válvulas`;
}

// Opciones de válvula afectada para el mantenimiento CORRECTIVO (ver
// ValveCorrectiveMaintenanceLog): el mismo juego completo de válvulas (ver
// ValveDates arriba) más "GENERAL" para reparaciones que no son de una
// válvula específica.
export type ValvulaCorrectiva =
  | "LLENADO"
  | "NO_RETROCESO"
  | "BYPASS"
  | "RETORNO_VAPORES"
  | "SERVICIO"
  | "MAXIMO_LLENADO"
  | "MAXIMO_LLENADO_85"
  | "ALIVIO"
  | "DESCARGA_EMERGENCIA"
  | "EXCESO_FLUJO"
  | "CHECK_LOCK"
  | "GENERAL";

export const valvulaCorrectivaLabels: Record<ValvulaCorrectiva, string> = {
  LLENADO: "Válvula de llenado",
  NO_RETROCESO: "Válvula de no retroceso (check)",
  BYPASS: "Válvula de bypass",
  RETORNO_VAPORES: "Válvula de retorno de vapores",
  SERVICIO: "Válvula de servicio de vapor",
  MAXIMO_LLENADO: "Válvula de máximo llenado 90%",
  MAXIMO_LLENADO_85: "Válvula de máximo llenado 85% (opcional)",
  ALIVIO: "Válvula de alivio (seguridad)",
  DESCARGA_EMERGENCIA: "Válvula de descarga de emergencia",
  EXCESO_FLUJO: "Válvula de exceso de flujo (litrómetro)",
  CHECK_LOCK: "Válvula check lock",
  GENERAL: "General",
};

// Vehículo con tanque de carburación solo tiene 4 de estas válvulas (ver
// lib/piece-catalog.ts, categoría "Válvulas", y TechnicalSheetForm.tsx):
// esta lista filtra y relabela las opciones solo para ese caso. Auto-Tanques
// y cualquier otro tipo de unidad siguen viendo el juego completo de 10
// (valvulaCorrectivaLabels de arriba, sin cambios).
const CARBURACION_VALVULAS_CORRECTIVAS: Partial<Record<ValvulaCorrectiva, string>> = {
  LLENADO: "Válvula de llenado (doble check)",
  MAXIMO_LLENADO: "Válvula de máximo llenado 90%",
  SERVICIO: "Válvula de servicio",
  ALIVIO: "Válvula de alivio (seguridad)",
  GENERAL: "General",
};

export function getValvulaCorrectivaOptions(sectionSlug?: string): [ValvulaCorrectiva, string][] {
  const source =
    sectionSlug === "vehiculo-con-tanque-de-carburacion"
      ? CARBURACION_VALVULAS_CORRECTIVAS
      : valvulaCorrectivaLabels;
  return Object.entries(source) as [ValvulaCorrectiva, string][];
}

// Para mostrar la etiqueta de un registro ya guardado (ver
// ValveCorrectiveMaintenanceLogRow.tsx): usa el nombre "de campo" si la
// unidad es de carburación y esa válvula tiene uno, si no cae al nombre de
// siempre.
export function getValvulaCorrectivaLabel(
  valvula: ValvulaCorrectiva | string,
  sectionSlug?: string
): string {
  if (sectionSlug === "vehiculo-con-tanque-de-carburacion") {
    const carburacionLabel = CARBURACION_VALVULAS_CORRECTIVAS[valvula as ValvulaCorrectiva];
    if (carburacionLabel) return carburacionLabel;
  }
  return valvulaCorrectivaLabels[valvula as ValvulaCorrectiva] ?? valvula;
}

export function valveAlertMessage(
  level: ValveAlertLevel,
  vencimiento: Date,
  numeroEconomico: string,
  valvulaMasAntigua?: keyof ValveDates
): string | null {
  if (level === "none") return null;
  const daysLeft = daysUntil(vencimiento);
  const nombreValvula = valvulaMasAntigua ? ` (${valveLabels[valvulaMasAntigua]})` : "";
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! El cambio de válvulas de la unidad "${numeroEconomico}"${nombreValvula} está VENCIDO desde hace ${Math.abs(daysLeft)} día(s).`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! El cambio de válvulas de la unidad "${numeroEconomico}"${nombreValvula} vence HOY.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el cambio de válvulas de la unidad "${numeroEconomico}"${nombreValvula}.`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el cambio de válvulas de la unidad "${numeroEconomico}"${nombreValvula}.`;
}
