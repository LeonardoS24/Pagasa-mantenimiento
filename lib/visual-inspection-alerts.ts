// Sistema de alertas de inspección visual EXTERNA de tanque: funciona igual
// que lib/ultrasound-alerts.ts (amarillo si falta 1 mes o menos, rojo si
// falta 1 semana o menos, incluye vencido), pero basado en
// fechaProximaInspeccionVisual.
import { daysUntil } from "./ultrasound-alerts";

export type VisualInspectionAlertLevel = "none" | "yellow" | "red";

export function getVisualInspectionAlertLevel(
  fechaProximaInspeccionVisual: Date | null | undefined
): VisualInspectionAlertLevel {
  if (!fechaProximaInspeccionVisual) return "none";
  const daysLeft = daysUntil(fechaProximaInspeccionVisual);
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "yellow";
  return "none";
}

export const visualInspectionAlertBadgeStyles: Record<VisualInspectionAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  red: "bg-red-100 text-red-800 border border-red-300",
};

export const visualInspectionAlertRowStyles: Record<VisualInspectionAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-50",
  red: "bg-red-50",
};

export function visualInspectionAlertLabel(level: VisualInspectionAlertLevel, fecha: Date): string {
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) return `Inspección visual externa vencida hace ${Math.abs(daysLeft)} día(s)`;
    if (daysLeft === 0) return "Inspección visual externa vence hoy";
    return `Faltan ${daysLeft} día(s) para la inspección visual externa`;
  }
  if (level === "yellow") return `Faltan ${daysLeft} día(s) para la inspección visual externa`;
  return "";
}

export function visualInspectionAlertMessage(
  level: VisualInspectionAlertLevel,
  fecha: Date,
  numeroEconomico: string,
  etiquetaTanque?: string
): string | null {
  if (level === "none") return null;
  const nombre = etiquetaTanque ? `${numeroEconomico} — ${etiquetaTanque}` : numeroEconomico;
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! La inspección visual externa del tanque de "${nombre}" está VENCIDA desde hace ${Math.abs(daysLeft)} día(s).`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! La inspección visual externa del tanque de "${nombre}" vence HOY.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para la inspección visual externa del tanque de "${nombre}".`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para la próxima inspección visual externa del tanque de "${nombre}".`;
}
