import { plazosActivos } from "./plazos";
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

// La cantidad de válvulas de seguridad varía por estación (1, 2 o 3, ver
// cantidadValvulasSeguridad en el schema): fechaFabricacionValvulaSeguridad
// es siempre la primera; estos dos campos solo se usan cuando la cantidad lo
// pide. null se trata como 1 en todos lados.
export const SEGURIDAD_EXTRA_FIELDS = [
  "fechaFabricacionValvulaSeguridad2",
  "fechaFabricacionValvulaSeguridad3",
] as const;
export type SeguridadExtraField = (typeof SEGURIDAD_EXTRA_FIELDS)[number];

export function cantidadValvulasSeguridad(dates: { cantidadValvulasSeguridad?: number | null }): number {
  const n = dates.cantidadValvulasSeguridad ?? 1;
  return n >= 1 && n <= 3 ? n : 1;
}

// Etiqueta de cualquier campo de válvula, incluidas las de seguridad
// 2/3 que no tienen entrada fija en stationValveLabels (solo existen cuando
// la estación de verdad tiene más de una).
export function stationValveFieldLabel(key: string): string {
  if (key === "fechaFabricacionValvulaSeguridad2") return "Válvula de seguridad 2";
  if (key === "fechaFabricacionValvulaSeguridad3") return "Válvula de seguridad 3";
  return stationValveLabels[key as StationValveField] ?? key;
}

export type StationValveDates = Partial<Record<StationValveField, Date | null | undefined>> & {
  fechaInstalacionValvulas?: Date | null | undefined;
  cantidadValvulasSeguridad?: number | null;
  fechaFabricacionValvulaSeguridad2?: Date | null | undefined;
  fechaFabricacionValvulaSeguridad3?: Date | null | undefined;
};

function addYears(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

// Plazo del catálogo de requisitos normativos (base 5 años, editable en
// /admin/normas) desde la fabricación de la válvula más antigua del juego.

// La válvula más antigua del juego es la que vence primero y marca cuándo
// toca cambiarlo. Las válvulas de seguridad 2/3 solo cuentan cuando la
// estación de verdad tiene esa cantidad (ver cantidadValvulasSeguridad).
export function oldestStationValve(dates: StationValveDates): { key: string; fecha: Date } | null {
  let oldest: { key: string; fecha: Date } | null = null;
  for (const key of STATION_VALVE_FIELDS) {
    const fecha = dates[key];
    if (fecha && (!oldest || fecha.getTime() < oldest.fecha.getTime())) {
      oldest = { key, fecha };
    }
  }
  const cantidad = cantidadValvulasSeguridad(dates);
  if (cantidad >= 2 && dates.fechaFabricacionValvulaSeguridad2) {
    const fecha = dates.fechaFabricacionValvulaSeguridad2;
    if (!oldest || fecha.getTime() < oldest.fecha.getTime()) {
      oldest = { key: "fechaFabricacionValvulaSeguridad2", fecha };
    }
  }
  if (cantidad >= 3 && dates.fechaFabricacionValvulaSeguridad3) {
    const fecha = dates.fechaFabricacionValvulaSeguridad3;
    if (!oldest || fecha.getTime() < oldest.fecha.getTime()) {
      oldest = { key: "fechaFabricacionValvulaSeguridad3", fecha };
    }
  }
  return oldest;
}

export function getStationValveVencimiento(dates: StationValveDates): Date | null {
  const oldest = oldestStationValve(dates);
  return oldest ? addYears(oldest.fecha, plazosActivos().valvulasEstacion) : null;
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
  valvulaMasAntigua?: string,
  etiquetaTanque?: string
): string | null {
  if (level === "none") return null;
  const daysLeft = daysUntil(vencimiento);
  const nombreValvula = valvulaMasAntigua ? ` (${stationValveFieldLabel(valvulaMasAntigua)})` : "";
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
