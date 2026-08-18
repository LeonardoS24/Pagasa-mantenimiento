// Alertas de vencimiento de la póliza de seguro de una unidad (ver
// InsurancePolicyLog en el schema y el apartado "Documentación" de la
// unidad). Mismo mecanismo y mismos umbrales que el resto de las alertas:
// rojo a una semana o menos, amarillo a un mes.
import { daysUntil } from "./ultrasound-alerts";

export type InsuranceAlertLevel = "none" | "yellow" | "red";

export function getInsuranceAlertLevel(
  fechaVencimiento: Date | null | undefined
): InsuranceAlertLevel {
  if (!fechaVencimiento) return "none";
  const daysLeft = daysUntil(fechaVencimiento);
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "yellow";
  return "none";
}

export const insuranceAlertBadgeStyles: Record<InsuranceAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  red: "bg-red-100 text-red-800 border border-red-300",
};

export const insuranceAlertRowStyles: Record<InsuranceAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-50",
  red: "bg-red-50",
};

export function insuranceAlertLabel(level: InsuranceAlertLevel, fecha: Date): string {
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) return `Póliza vencida hace ${Math.abs(daysLeft)} día(s)`;
    if (daysLeft === 0) return "La póliza vence hoy";
    return `Faltan ${daysLeft} día(s) para que venza la póliza`;
  }
  if (level === "yellow") return `Faltan ${daysLeft} día(s) para que venza la póliza`;
  return "";
}

export function insuranceAlertMessage(
  level: InsuranceAlertLevel,
  fecha: Date,
  numeroEconomico: string
): string | null {
  if (level === "none") return null;
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! La póliza de seguro de "${numeroEconomico}" está VENCIDA desde hace ${Math.abs(daysLeft)} día(s).`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! La póliza de seguro de "${numeroEconomico}" vence HOY.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para que venza la póliza de seguro de "${numeroEconomico}".`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para que venza la póliza de seguro de "${numeroEconomico}".`;
}
