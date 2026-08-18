// Alertas de prueba hidrostática de tanque: mismo mecanismo que
// lib/ultrasound-alerts.ts, basado en fechaProximaPruebaHidrostatica (que
// se calcula sola cada 10 años a partir de la fecha de fabricación).
import { daysUntil } from "./ultrasound-alerts";

export type HydrostaticTestAlertLevel = "none" | "yellow" | "red";

export function getHydrostaticTestAlertLevel(
  fechaProximaPruebaHidrostatica: Date | null | undefined
): HydrostaticTestAlertLevel {
  if (!fechaProximaPruebaHidrostatica) return "none";
  const daysLeft = daysUntil(fechaProximaPruebaHidrostatica);
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "yellow";
  return "none";
}

export const hydrostaticTestAlertBadgeStyles: Record<HydrostaticTestAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  red: "bg-red-100 text-red-800 border border-red-300",
};

export const hydrostaticTestAlertRowStyles: Record<HydrostaticTestAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-50",
  red: "bg-red-50",
};

export function hydrostaticTestAlertLabel(level: HydrostaticTestAlertLevel, fecha: Date): string {
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) return `Prueba hidrostática vencida hace ${Math.abs(daysLeft)} día(s)`;
    if (daysLeft === 0) return "Prueba hidrostática vence hoy";
    return `Faltan ${daysLeft} día(s) para la prueba hidrostática`;
  }
  if (level === "yellow") return `Faltan ${daysLeft} día(s) para la prueba hidrostática`;
  return "";
}

export function hydrostaticTestAlertMessage(
  level: HydrostaticTestAlertLevel,
  fecha: Date,
  numeroEconomico: string,
  etiquetaTanque?: string
): string | null {
  if (level === "none") return null;
  const nombre = etiquetaTanque ? `${numeroEconomico} — ${etiquetaTanque}` : numeroEconomico;
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! La prueba hidrostática del tanque de "${nombre}" está VENCIDA desde hace ${Math.abs(daysLeft)} día(s).`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! La prueba hidrostática del tanque de "${nombre}" vence HOY.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para la prueba hidrostática del tanque de "${nombre}".`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para la próxima prueba hidrostática del tanque de "${nombre}".`;
}
