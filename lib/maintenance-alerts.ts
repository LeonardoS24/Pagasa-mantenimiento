import { daysUntil } from "./ultrasound-alerts";

// Aviso de mantenimiento preventivo: vence a los 10,000 km o 6 meses desde
// el último mantenimiento con kilometraje, lo que se cumpla primero. Como el
// sistema no tiene un odómetro en vivo, el aviso automático (el que se ve
// cada vez que se entra a la unidad) se evalúa por fecha —lo único que se
// puede verificar sin dato nuevo—; el kilometraje objetivo se muestra como
// referencia para que el personal lo confirme contra el odómetro real.
export type MaintenanceAlertLevel = "none" | "yellow" | "red";

export function getMaintenanceAlertLevel(
  fechaProximoMantenimiento: Date | null | undefined
): MaintenanceAlertLevel {
  if (!fechaProximoMantenimiento) return "none";
  const daysLeft = daysUntil(fechaProximoMantenimiento);
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "yellow";
  return "none";
}

export const maintenanceAlertBadgeStyles: Record<MaintenanceAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  red: "bg-red-100 text-red-800 border border-red-300",
};

export const maintenanceAlertRowStyles: Record<MaintenanceAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-50",
  red: "bg-red-50",
};

function kilometrajeSuffix(kilometrajeProximoMantenimiento: number | null | undefined): string {
  return kilometrajeProximoMantenimiento
    ? ` o a los ${kilometrajeProximoMantenimiento.toLocaleString("es-MX")} km`
    : "";
}

export function maintenanceAlertLabel(
  level: MaintenanceAlertLevel,
  fecha: Date,
  kilometrajeProximoMantenimiento?: number | null
): string {
  if (level === "none") return "";
  const daysLeft = daysUntil(fecha);
  const kmSuffix = kilometrajeSuffix(kilometrajeProximoMantenimiento);
  if (level === "red") {
    if (daysLeft < 0) return `Mantenimiento preventivo vencido hace ${Math.abs(daysLeft)} día(s)${kmSuffix}`;
    if (daysLeft === 0) return `Mantenimiento preventivo vence hoy${kmSuffix}`;
    return `Faltan ${daysLeft} día(s) para el mantenimiento preventivo${kmSuffix}`;
  }
  return `Faltan ${daysLeft} día(s) para el mantenimiento preventivo${kmSuffix}`;
}

export function maintenanceAlertMessage(
  level: MaintenanceAlertLevel,
  fecha: Date,
  numeroEconomico: string,
  kilometrajeProximoMantenimiento?: number | null
): string | null {
  if (level === "none") return null;
  const daysLeft = daysUntil(fecha);
  const kmSuffix = kilometrajeSuffix(kilometrajeProximoMantenimiento);
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! El mantenimiento preventivo de la unidad "${numeroEconomico}" está VENCIDO desde hace ${Math.abs(daysLeft)} día(s)${kmSuffix}.`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! El mantenimiento preventivo de la unidad "${numeroEconomico}" vence HOY${kmSuffix}.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el mantenimiento preventivo de la unidad "${numeroEconomico}"${kmSuffix}.`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el próximo mantenimiento preventivo de la unidad "${numeroEconomico}"${kmSuffix}.`;
}
