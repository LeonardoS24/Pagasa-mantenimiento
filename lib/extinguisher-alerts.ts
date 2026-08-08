// Sistema de alertas de extintor: a diferencia de las demás pruebas, no se
// basa en una fecha próxima sino en la calidad. Cuando calidadExtintor pasa
// a "MALA" se registra fechaCalidadMalaExtintor (ver actions/vehicle-actions.ts
// y actions/extinguisher-actions.ts); la alerta se mantiene amarilla los
// primeros 2 días desde esa fecha y pasa a roja a partir del día 2.
export type ExtinguisherAlertLevel = "none" | "yellow" | "red";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
}

export function getExtinguisherAlertLevel(
  calidad: string | null | undefined,
  fechaCalidadMala: Date | null | undefined
): ExtinguisherAlertLevel {
  if (calidad !== "MALA") return "none";
  if (!fechaCalidadMala) return "yellow";
  return daysSince(fechaCalidadMala) >= 2 ? "red" : "yellow";
}

export const extinguisherAlertBadgeStyles: Record<ExtinguisherAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  red: "bg-red-100 text-red-800 border border-red-300",
};

export const extinguisherAlertRowStyles: Record<ExtinguisherAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-50",
  red: "bg-red-50",
};

export function extinguisherAlertLabel(
  level: ExtinguisherAlertLevel,
  fechaCalidadMala: Date | null | undefined
): string {
  if (level === "none") return "";
  const days = fechaCalidadMala ? daysSince(fechaCalidadMala) : 0;
  return `Extintor en mal estado desde hace ${days} día(s)`;
}

export function extinguisherAlertMessage(
  level: ExtinguisherAlertLevel,
  fechaCalidadMala: Date | null | undefined,
  numeroEconomico: string
): string | null {
  if (level === "none") return null;
  const days = fechaCalidadMala ? daysSince(fechaCalidadMala) : 0;
  if (level === "red") {
    return `¡URGENTE! El extintor de la unidad "${numeroEconomico}" lleva ${days} día(s) en mal estado: hay que ordenarlo y/o cambiarlo de inmediato.`;
  }
  return `Atención: el extintor de la unidad "${numeroEconomico}" está en mal estado, hay que ordenarlo y/o cambiarlo cuanto antes.`;
}
