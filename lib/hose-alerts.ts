import { daysUntil } from "./ultrasound-alerts";
import { plazosActivos } from "./plazos";

// Alerta de cambio de mangueras (mismo esquema amarillo/rojo que
// válvulas/ultrasonido), sobre una sola fecha en vez de la más antigua de
// varias. Los plazos son los del catálogo de requisitos normativos (ver
// lib/requisitos-normativos.ts, editables en /admin/normas):
// - Vehículo con tanque de carburación: base 2 años (manguera de alta presión).
// - Auto-Tanques: base 5 años desde la fabricación de la manguera de trasiego
//   (NOM-EM-009-ASEA-2026, Tabla 4, inciso t). Semirremolques: sin alerta.
export type HoseAlertLevel = "none" | "yellow" | "red";

// Qué fecha y qué plazo le toca a cada apartado. La manguera de trasiego de
// los tanques de carga es la "manguera de surtir" de su ficha técnica.
export function mangueraParaAlerta(
  sectionSlug: string | null | undefined,
  sheet: { fechaFabricacionManguera?: Date | null; fechaFabricacionMangueraSurtir?: Date | null } | null | undefined
): { fecha: Date | null; anios: number } {
  if (sectionSlug === "auto-tanques") {
    return { fecha: sheet?.fechaFabricacionMangueraSurtir ?? null, anios: plazosActivos().mangueraTrasiego };
  }
  // La NOM-EM-008 (Semirremolques) no fija plazo para la manguera: sin alerta.
  if (sectionSlug === "semirremolques") return { fecha: null, anios: plazosActivos().mangueraTrasiego };
  return { fecha: sheet?.fechaFabricacionManguera ?? null, anios: plazosActivos().mangueraCarburacion };
}

// Conector flexible del tanque de carga (Auto-Tanques y Semirremolques): se
// sustituye a los 5 años de su fabricación (NOM-EM-009 Tabla 4 p; NOM-EM-008
// Tabla 3). Su alerta sale junto con la de mangueras.
export function conectorParaAlerta(
  sectionSlug: string | null | undefined,
  sheet: { fechaFabricacionConectorFlexible?: Date | null } | null | undefined
): { fecha: Date | null; anios: number } {
  const anios = plazosActivos().conectorFlexible;
  if (sectionSlug === "auto-tanques" || sectionSlug === "semirremolques") {
    return { fecha: sheet?.fechaFabricacionConectorFlexible ?? null, anios };
  }
  return { fecha: null, anios };
}

function addYears(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

export function getHoseVencimiento(
  fechaFabricacionManguera: Date | null | undefined,
  anios: number = plazosActivos().mangueraCarburacion
): Date | null {
  return fechaFabricacionManguera ? addYears(fechaFabricacionManguera, anios) : null;
}

export function getHoseAlertLevel(
  fechaFabricacionManguera: Date | null | undefined,
  anios: number = plazosActivos().mangueraCarburacion
): HoseAlertLevel {
  const vencimiento = getHoseVencimiento(fechaFabricacionManguera, anios);
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

// "cambio de mangueras" / "cambio del conector flexible" según el elemento.
function cambioDe(elemento?: string): string {
  return elemento === "Conector flexible" ? "cambio del conector flexible" : "cambio de mangueras";
}

export function hoseAlertLabel(level: HoseAlertLevel, vencimiento: Date, elemento?: string): string {
  if (level === "none") return "";
  const daysLeft = daysUntil(vencimiento);
  const cambio = cambioDe(elemento);
  const Cambio = cambio.charAt(0).toUpperCase() + cambio.slice(1);
  if (level === "red") {
    if (daysLeft < 0) return `${Cambio} vencido hace ${Math.abs(daysLeft)} día(s)`;
    if (daysLeft === 0) return `${Cambio} vence hoy`;
    return `Faltan ${daysLeft} día(s) para el ${cambio}`;
  }
  return `Faltan ${daysLeft} día(s) para el ${cambio}`;
}

export function hoseAlertMessage(
  level: HoseAlertLevel,
  vencimiento: Date,
  numeroEconomico: string,
  elemento?: string
): string | null {
  if (level === "none") return null;
  const daysLeft = daysUntil(vencimiento);
  const cambio = cambioDe(elemento);
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! El ${cambio} de la unidad "${numeroEconomico}" está VENCIDO desde hace ${Math.abs(daysLeft)} día(s).`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! El ${cambio} de la unidad "${numeroEconomico}" vence HOY.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el ${cambio} de la unidad "${numeroEconomico}".`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el ${cambio} de la unidad "${numeroEconomico}".`;
}
