// Sistema de alertas de ultrasonido de tanque: amarillo cuando falta 1 mes o
// menos para la fecha próxima de ultrasonido, rojo cuando falta 1 semana o
// menos (incluye vencido). Se usa tanto para resaltar unidades en tablas
// como para el panel de alertas del dashboard.
export type UltrasoundAlertLevel = "none" | "yellow" | "red";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / MS_PER_DAY);
}

export function getUltrasoundAlertLevel(
  fechaProximoUltrasonido: Date | null | undefined
): UltrasoundAlertLevel {
  if (!fechaProximoUltrasonido) return "none";
  const daysLeft = daysUntil(fechaProximoUltrasonido);
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "yellow";
  return "none";
}

export const ultrasoundAlertBadgeStyles: Record<UltrasoundAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  red: "bg-red-100 text-red-800 border border-red-300",
};

export const ultrasoundAlertRowStyles: Record<UltrasoundAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-50",
  red: "bg-red-50",
};

export function ultrasoundAlertLabel(level: UltrasoundAlertLevel, fecha: Date): string {
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) return `Ultrasonido vencido hace ${Math.abs(daysLeft)} día(s)`;
    if (daysLeft === 0) return "Ultrasonido vence hoy";
    return `Faltan ${daysLeft} día(s) para el ultrasonido`;
  }
  if (level === "yellow") return `Faltan ${daysLeft} día(s) para el ultrasonido`;
  return "";
}

export function ultrasoundAlertMessage(
  level: UltrasoundAlertLevel,
  fecha: Date,
  numeroEconomico: string,
  etiquetaTanque?: string
): string | null {
  if (level === "none") return null;
  const nombre = etiquetaTanque ? `${numeroEconomico} — ${etiquetaTanque}` : numeroEconomico;
  const daysLeft = daysUntil(fecha);
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! El ultrasonido del tanque de "${nombre}" está VENCIDO desde hace ${Math.abs(daysLeft)} día(s).`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! El ultrasonido del tanque de "${nombre}" vence HOY.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el ultrasonido del tanque de "${nombre}".`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el próximo ultrasonido del tanque de "${nombre}".`;
}
