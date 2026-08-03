import { daysUntil } from "./ultrasound-alerts";

// Alerta de cambio de válvulas: vence a los 5 años de fabricación de la más
// antigua de las 4 válvulas (llenado, servicio, máximo llenado, alivio).
// Mismo esquema amarillo/rojo que el ultrasonido.
export type ValveAlertLevel = "none" | "yellow" | "red";

export type ValveDates = {
  fechaFabricacionValvulaLlenado: Date | null | undefined;
  fechaFabricacionValvulaServicio: Date | null | undefined;
  fechaFabricacionValvulaMaximoLlenado: Date | null | undefined;
  fechaFabricacionValvulaAlivio: Date | null | undefined;
};

export const valveLabels: Record<keyof ValveDates, string> = {
  fechaFabricacionValvulaLlenado: "Válvula de llenado",
  fechaFabricacionValvulaServicio: "Válvula de servicio",
  fechaFabricacionValvulaMaximoLlenado: "Válvula de máximo llenado",
  fechaFabricacionValvulaAlivio: "Válvula de alivio (seguridad)",
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

export const valveAlertBadgeStyles: Record<ValveAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  red: "bg-red-100 text-red-800 border border-red-300",
};

export const valveAlertRowStyles: Record<ValveAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-50",
  red: "bg-red-50",
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
// ValveCorrectiveMaintenanceLog): las mismas 4 válvulas más "GENERAL" para
// reparaciones que no son de una válvula específica.
export type ValvulaCorrectiva = "LLENADO" | "SERVICIO" | "MAXIMO_LLENADO" | "ALIVIO" | "GENERAL";

export const valvulaCorrectivaLabels: Record<ValvulaCorrectiva, string> = {
  LLENADO: "Válvula de llenado",
  SERVICIO: "Válvula de servicio",
  MAXIMO_LLENADO: "Válvula de máximo llenado",
  ALIVIO: "Válvula de alivio (seguridad)",
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
