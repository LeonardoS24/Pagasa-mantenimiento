// Sistema de alertas de prueba de hermeticidad de tanque: funciona igual que
// lib/ultrasound-alerts.ts (amarillo si falta 1 mes o menos, rojo si falta 1
// semana o menos, incluye vencido), pero basado en fechaProximaPruebaHermeticidad.
import { daysUntil } from "./ultrasound-alerts";

export type TightnessTestAlertLevel = "none" | "yellow" | "red";

export function getTightnessTestAlertLevel(
  fechaProximaPruebaHermeticidad: Date | null | undefined
): TightnessTestAlertLevel {
  if (!fechaProximaPruebaHermeticidad) return "none";
  const daysLeft = daysUntil(fechaProximaPruebaHermeticidad);
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "yellow";
  return "none";
}

export const tightnessTestAlertBadgeStyles: Record<TightnessTestAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  red: "bg-red-100 text-red-800 border border-red-300",
};

export const tightnessTestAlertRowStyles: Record<TightnessTestAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-50",
  red: "bg-red-50",
};

export function tightnessTestAlertLabel(level: TightnessTestAlertLevel, fecha: Date): string {
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) return `Prueba de hermeticidad vencida hace ${Math.abs(daysLeft)} día(s)`;
    if (daysLeft === 0) return "Prueba de hermeticidad vence hoy";
    return `Faltan ${daysLeft} día(s) para la prueba de hermeticidad`;
  }
  if (level === "yellow") return `Faltan ${daysLeft} día(s) para la prueba de hermeticidad`;
  return "";
}

export function tightnessTestAlertMessage(
  level: TightnessTestAlertLevel,
  fecha: Date,
  numeroEconomico: string
): string | null {
  if (level === "none") return null;
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! La prueba de hermeticidad del tanque de "${numeroEconomico}" está VENCIDA desde hace ${Math.abs(daysLeft)} día(s).`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! La prueba de hermeticidad del tanque de "${numeroEconomico}" vence HOY.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para la prueba de hermeticidad del tanque de "${numeroEconomico}".`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para la próxima prueba de hermeticidad del tanque de "${numeroEconomico}".`;
}
