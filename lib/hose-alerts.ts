import { daysUntil } from "./ultrasound-alerts";

// Alerta de cambio de mangueras: vence a los 2 años de fabricación de la
// manguera (mismo esquema amarillo/rojo que válvulas/ultrasonido), pero
// sobre una sola fecha en vez de la más antigua de varias.
export type HoseAlertLevel = "none" | "yellow" | "red";

function addYears(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

export function getHoseVencimiento(fechaFabricacionManguera: Date | null | undefined): Date | null {
  return fechaFabricacionManguera ? addYears(fechaFabricacionManguera, 2) : null;
}

export function getHoseAlertLevel(fechaFabricacionManguera: Date | null | undefined): HoseAlertLevel {
  const vencimiento = getHoseVencimiento(fechaFabricacionManguera);
  if (!vencimiento) return "none";
  const daysLeft = daysUntil(vencimiento);
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "yellow";
  return "none";
}

export const hoseAlertBadgeStyles: Record<HoseAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  red: "bg-red-100 text-red-800 border border-red-300",
};

export const hoseAlertRowStyles: Record<HoseAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-50",
  red: "bg-red-50",
};

export function hoseAlertLabel(level: HoseAlertLevel, vencimiento: Date): string {
  if (level === "none") return "";
  const daysLeft = daysUntil(vencimiento);
  if (level === "red") {
    if (daysLeft < 0) return `Cambio de mangueras vencido hace ${Math.abs(daysLeft)} día(s)`;
    if (daysLeft === 0) return "Cambio de mangueras vence hoy";
    return `Faltan ${daysLeft} día(s) para el cambio de mangueras`;
  }
  return `Faltan ${daysLeft} día(s) para el cambio de mangueras`;
}

export function hoseAlertMessage(
  level: HoseAlertLevel,
  vencimiento: Date,
  numeroEconomico: string
): string | null {
  if (level === "none") return null;
  const daysLeft = daysUntil(vencimiento);
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! El cambio de mangueras de la unidad "${numeroEconomico}" está VENCIDO desde hace ${Math.abs(daysLeft)} día(s).`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! El cambio de mangueras de la unidad "${numeroEconomico}" vence HOY.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el cambio de mangueras de la unidad "${numeroEconomico}".`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el cambio de mangueras de la unidad "${numeroEconomico}".`;
}
