import { daysUntil } from "./ultrasound-alerts";

// Alerta de cambio de válvulas: vence a los 5 años de fabricación de la más
// antigua de todo el juego. Mismo esquema amarillo/rojo que el ultrasonido.
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
};

export const valveLabels: Record<keyof ValveDates, string> = {
  fechaFabricacionValvulaLlenado: "Válvula de llenado",
  fechaFabricacionValvulaNoRetroceso: "Válvula de no retroceso (check)",
  fechaFabricacionValvulaBypass: "Válvula de retroceso (bypass)",
  fechaFabricacionValvulaRetornoVapores: "Válvula de retorno de vapores",
  fechaFabricacionValvulaServicio: "Válvula de servicio de vapor",
  fechaFabricacionValvulaMaximoLlenado: "Válvula de máximo llenado 90%",
  fechaFabricacionValvulaMaximoLlenado85: "Válvula de máximo llenado 85% (opcional)",
  fechaFabricacionValvulaAlivio: "Válvula de seguridad",
  fechaFabricacionValvulaDescargaEmergencia: "Válvula de descarga de emergencia",
};

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

export function getValveVencimiento(dates: ValveDates): Date | null {
  const oldest = oldestValve(dates);
  return oldest ? addYears(oldest.fecha, 5) : null;
}

export function getValveAlertLevel(dates: ValveDates): ValveAlertLevel {
  const vencimiento = getValveVencimiento(dates);
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
  | "GENERAL";

export const valvulaCorrectivaLabels: Record<ValvulaCorrectiva, string> = {
  LLENADO: "Válvula de llenado",
  NO_RETROCESO: "Válvula de no retroceso (check)",
  BYPASS: "Válvula de retroceso (bypass)",
  RETORNO_VAPORES: "Válvula de retorno de vapores",
  SERVICIO: "Válvula de servicio de vapor",
  MAXIMO_LLENADO: "Válvula de máximo llenado 90%",
  MAXIMO_LLENADO_85: "Válvula de máximo llenado 85% (opcional)",
  ALIVIO: "Válvula de seguridad",
  DESCARGA_EMERGENCIA: "Válvula de descarga de emergencia",
  GENERAL: "General",
};

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
