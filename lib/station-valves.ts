import { daysUntil } from "./ultrasound-alerts";
import type { ValveAlertLevel } from "./valve-alerts";

// Las válvulas de una Estación de carburación (y de una Planta) NO son las
// mismas que las de un Auto-Tanque: un tanque fijo tiene exceso de flujo y
// check lock, y no tiene bypass, retorno de vapores, máximo llenado ni
// descarga de emergencia. Salen de la relación que lleva el equipo
// ("Fechas de valvulas.xls", hoja "Dat. Carbs"), de donde se cargaron los
// datos iniciales.
//
// El juego de un vehículo vive aparte en lib/valve-alerts.ts; no se mezclan
// a propósito, porque son sistemas físicos distintos.
//
// La de relevo hidrostático que aparece en esa relación NO está aquí a
// propósito: va montada en la tubería, no en el tanque, así que no es parte
// del juego de válvulas del recipiente ni de su ciclo de reemplazo.
export const STATION_VALVE_FIELDS = [
  "fechaFabricacionValvulaExcesoFlujo",
  "fechaFabricacionValvulaNoRetroceso",
  "fechaFabricacionValvulaSeguridad",
  "fechaFabricacionValvulaLlenado",
  "fechaFabricacionValvulaServicio",
  "fechaFabricacionValvulaCheckLock",
  "fechaFabricacionValvulaVapor",
] as const;

export type StationValveField = (typeof STATION_VALVE_FIELDS)[number];

export const stationValveLabels: Record<StationValveField, string> = {
  fechaFabricacionValvulaExcesoFlujo: "Válvula de exceso de flujo",
  fechaFabricacionValvulaNoRetroceso: "Válvula de no retroceso",
  fechaFabricacionValvulaSeguridad: "Válvula de seguridad",
  fechaFabricacionValvulaLlenado: "Válvula de llenado",
  fechaFabricacionValvulaServicio: "Válvula de servicio",
  fechaFabricacionValvulaCheckLock: "Válvula check lock",
  fechaFabricacionValvulaVapor: "Válvula de vapor",
};

export type StationValveDates = Partial<Record<StationValveField, Date | null | undefined>> & {
  fechaInstalacionValvulas?: Date | null | undefined;
};

function addYears(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

// Mismo plazo que las unidades (ver lib/valve-alerts.ts): 5 años desde la
// fabricación de la válvula más antigua del juego.
export const STATION_VALVE_YEARS = 5;

// La válvula más antigua del juego es la que vence primero y marca cuándo
// toca cambiarlo.
export function oldestStationValve(
  dates: StationValveDates
): { key: StationValveField; fecha: Date } | null {
  let oldest: { key: StationValveField; fecha: Date } | null = null;
  for (const key of STATION_VALVE_FIELDS) {
    const fecha = dates[key];
    if (fecha && (!oldest || fecha.getTime() < oldest.fecha.getTime())) {
      oldest = { key, fecha };
    }
  }
  return oldest;
}

export function getStationValveVencimiento(dates: StationValveDates): Date | null {
  const oldest = oldestStationValve(dates);
  return oldest ? addYears(oldest.fecha, STATION_VALVE_YEARS) : null;
}

// Mismos umbrales que la alerta de válvulas de una unidad (ver
// getValveAlertLevel en lib/valve-alerts.ts), para que se lean igual: rojo a
// una semana o menos, amarillo a un mes.
export function getStationValveAlertLevel(vencimiento: Date | null): ValveAlertLevel {
  if (!vencimiento) return "none";
  const daysLeft = daysUntil(vencimiento);
  if (daysLeft <= 7) return "red";
  if (daysLeft <= 30) return "yellow";
  return "none";
}

// Mismo texto que valveAlertLabel (lib/valve-alerts.ts) — no depende del
// juego de válvulas, solo de nivel y fecha, así que se reutiliza tal cual
// donde haga falta (ver ValveAlertsPanel).

// Igual que valveAlertMessage (lib/valve-alerts.ts) pero con el vocabulario
// de válvulas de estación (nombreEstacion en vez de numeroEconomico de
// unidad, y el juego de 7 válvulas propio del tanque fijo). etiquetaTanque
// se agrega cuando la estación tiene más de un tanque, para saber cuál de
// los dos es.
export function getStationValveAlertMessage(
  level: ValveAlertLevel,
  vencimiento: Date,
  nombreEstacion: string,
  valvulaMasAntigua?: StationValveField,
  etiquetaTanque?: string
): string | null {
  if (level === "none") return null;
  const daysLeft = daysUntil(vencimiento);
  const nombreValvula = valvulaMasAntigua ? ` (${stationValveLabels[valvulaMasAntigua]})` : "";
  const nombreCompleto = etiquetaTanque ? `${nombreEstacion} — ${etiquetaTanque}` : nombreEstacion;
  if (level === "red") {
    if (daysLeft < 0) {
      return `¡URGENTE! El cambio de válvulas de la estación "${nombreCompleto}"${nombreValvula} está VENCIDO desde hace ${Math.abs(daysLeft)} día(s).`;
    }
    if (daysLeft === 0) {
      return `¡URGENTE! El cambio de válvulas de la estación "${nombreCompleto}"${nombreValvula} vence HOY.`;
    }
    return `¡URGENTE! Solo falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el cambio de válvulas de la estación "${nombreCompleto}"${nombreValvula}.`;
  }
  return `Atención: falta${daysLeft === 1 ? "" : "n"} ${daysLeft} día(s) para el cambio de válvulas de la estación "${nombreCompleto}"${nombreValvula}.`;
}
