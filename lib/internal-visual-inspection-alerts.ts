// Alertas de inspección visual INTERNA de tanque: mismo mecanismo que
// lib/ultrasound-alerts.ts, basado en fechaProximaInspeccionVisualInterna
// (que se calcula sola cada 10 años a partir de la fecha de fabricación).
import { daysUntil } from "./ultrasound-alerts";

export type InternalVisualInspectionAlertLevel = "none" | "yellow" | "red";

export function getInternalVisualInspectionAlertLevel(
  fechaProximaInspeccionVisualInterna: Date | null | undefined
): InternalVisualInspectionAlertLevel {
  if (!fechaProximaInspeccionVisualInterna) return "none";
  const daysLeft = daysUntil(fechaProximaInspeccionVisualInterna);
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "yellow";
  return "none";
}

export const internalVisualInspectionAlertBadgeStyles: Record<InternalVisualInspectionAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  red: "bg-red-100 text-red-800 border border-red-300",
};

export const internalVisualInspectionAlertRowStyles: Record<InternalVisualInspectionAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-50",
  red: "bg-red-50",
};

export function internalVisualInspectionAlertLabel(
  level: InternalVisualInspectionAlertLevel,
  fecha: Date
): string {
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) return `Inspección visual interna vencida hace ${Math.abs(daysLeft)} día(s)`;
    if (daysLeft === 0) return "Inspección visual interna vence hoy";
    return `Faltan ${daysLeft} día(s) para la inspección visual interna`;
  }
  if (level === "yellow") return `Faltan ${daysLeft} día(s) para la inspección visual interna`;
  return "";
}

export function internalVisualInspectionAlertMessage(
  level: InternalVisualInspectionAlertLevel,
  fecha: Date,
  numeroEconomico: string
): string | null {
  if (level === "none") return null;
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! La inspección visual interna del tanque de "${numeroEconomico}" está VENCIDA desde hace ${Math.abs(daysLeft)} día(s).`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! La inspección visual interna del tanque de "${numeroEconomico}" vence HOY.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para la inspección visual interna del tanque de "${numeroEconomico}".`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para la próxima inspección visual interna del tanque de "${numeroEconomico}".`;
}
