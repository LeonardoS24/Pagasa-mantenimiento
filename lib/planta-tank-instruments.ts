import { plazosActivos } from "./plazos";
import { daysUntil } from "./ultrasound-alerts";
import type { ValveAlertLevel } from "./valve-alerts";

// Válvulas e instrumentos de un tanque de Planta: a diferencia de las
// válvulas de Estación de carburación (ver lib/station-valves.ts, que dan
// una sola alerta combinada por el juego completo), aquí cada instrumento
// tiene sus propias 3 fechas (fabricación/cambio/instalación) y su propia
// alerta por separado, sin mezclarse con los demás.
export const PLANTA_INSTRUMENT_FIELDS = [
  "maximoLlenado",
  "manometro",
  "termometro",
  "excesoFlujoNoRetroceso",
  "relevoPresion",
] as const;

export type PlantaInstrumentField = (typeof PLANTA_INSTRUMENT_FIELDS)[number];

export const plantaInstrumentLabels: Record<PlantaInstrumentField, string> = {
  maximoLlenado: "Válvula de máximo llenado",
  manometro: "Manómetro",
  termometro: "Termómetro",
  excesoFlujoNoRetroceso: "Válvula de exceso de flujo / no retroceso",
  relevoPresion: "Válvula de relevo de presión",
};

export function instrumentFabricacionField(campo: PlantaInstrumentField) {
  return `${campo}FechaFabricacion` as const;
}
export function instrumentCambioField(campo: PlantaInstrumentField) {
  return `${campo}FechaCambio` as const;
}
export function instrumentInstalacionField(campo: PlantaInstrumentField) {
  return `${campo}FechaInstalacion` as const;
}

export type PlantaInstrumentDates = Partial<
  Record<
    | `${PlantaInstrumentField}FechaFabricacion`
    | `${PlantaInstrumentField}FechaCambio`
    | `${PlantaInstrumentField}FechaInstalacion`,
    Date | null | undefined
  >
>;

function addYears(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

// NOM-018-ASEA-2023: las válvulas de exceso de flujo, no retroceso y relevo
// de presión se reemplazan a los 10 años de su fabricación (o antes, si la
// garantía del fabricante es menor); el resto de los instrumentos, según la
// vida útil que marque el fabricante (sin número en la norma: el sistema usa
// 10 años como tope). Ambos plazos son del catálogo de requisitos normativos
// (editables en /admin/normas), contados desde la fecha de cambio más
// reciente o, si nunca se ha cambiado, desde la fecha de fabricación.
const VALVULAS_DE_SEGURIDAD: PlantaInstrumentField[] = ["excesoFlujoNoRetroceso", "relevoPresion"];

export function getPlantaInstrumentVencimiento(
  dates: PlantaInstrumentDates,
  campo: PlantaInstrumentField
): Date | null {
  const base = dates[instrumentCambioField(campo)] ?? dates[instrumentFabricacionField(campo)];
  if (!base) return null;
  const plazos = plazosActivos();
  return addYears(base, VALVULAS_DE_SEGURIDAD.includes(campo) ? plazos.instrumentosPlantaValvulas : plazos.instrumentosPlanta);
}

export function getPlantaInstrumentAlertLevel(vencimiento: Date | null): ValveAlertLevel {
  if (!vencimiento) return "none";
  const daysLeft = daysUntil(vencimiento);
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "yellow";
  return "none";
}

// Un instrumento por alerta, a diferencia de getStationValveAlertMessage
// (que junta las 7 válvulas de estación en un solo mensaje).
export function getPlantaInstrumentAlertMessage(
  level: ValveAlertLevel,
  vencimiento: Date,
  nombrePlanta: string,
  campo: PlantaInstrumentField,
  etiquetaTanque?: string
): string | null {
  if (level === "none") return null;
  const daysLeft = daysUntil(vencimiento);
  const nombreInstrumento = plantaInstrumentLabels[campo];
  const nombreCompleto = etiquetaTanque ? `${nombrePlanta} — ${etiquetaTanque}` : nombrePlanta;
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! El cambio de "${nombreInstrumento}" del tanque de "${nombreCompleto}" está VENCIDO desde hace ${Math.abs(daysLeft)} día(s).`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! El cambio de "${nombreInstrumento}" del tanque de "${nombreCompleto}" vence HOY.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el cambio de "${nombreInstrumento}" del tanque de "${nombreCompleto}".`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el cambio de "${nombreInstrumento}" del tanque de "${nombreCompleto}".`;
}
