import { daysUntil } from "@/lib/ultrasound-alerts";
import { getExtinguisherAlertLevel } from "@/lib/extinguisher-alerts";
import { aniosVigenciaValvulas, getValveVencimiento, type ValveDates } from "@/lib/valve-alerts";
import { getStationValveVencimiento, type StationValveDates } from "@/lib/station-valves";
import { getHoseVencimiento } from "@/lib/hose-alerts";
import { isAlertVisibleForSection, type AlertType } from "@/lib/alert-visibility";

// Semáforo por unidad para los listados (VehicleTable/AggregateVehicleTable):
// a diferencia de las alertas de Inicio (que son por tipo de prueba), esto es
// UN solo indicador por fila que resume qué tan urgente es lo más próximo a
// vencer de esa unidad. Verde = faltan 2 meses, amarillo = falta 1 mes,
// naranja = falta 1 semana, rojo = ya venció. Sin color si todo está bien
// (a más de 2 meses) o no aplica ninguna prueba a esa unidad.
export type SemaforoLevel = "none" | "verde" | "amarillo" | "naranja" | "rojo";

const SEMAFORO_ORDER: Record<SemaforoLevel, number> = {
  none: 0,
  verde: 1,
  amarillo: 2,
  naranja: 3,
  rojo: 4,
};

function semaforoFromDays(daysLeft: number): SemaforoLevel {
  if (daysLeft < 0) return "rojo";
  if (daysLeft <= 7) return "naranja";
  if (daysLeft <= 30) return "amarillo";
  if (daysLeft <= 60) return "verde";
  return "none";
}

function mostUrgent(a: SemaforoLevel, b: SemaforoLevel): SemaforoLevel {
  return SEMAFORO_ORDER[b] > SEMAFORO_ORDER[a] ? b : a;
}

export const semaforoDotStyles: Record<SemaforoLevel, string> = {
  none: "",
  verde: "bg-green-500",
  amarillo: "bg-yellow-400",
  naranja: "bg-orange-500",
  rojo: "bg-red-600",
};

export const semaforoLabels: Record<SemaforoLevel, string> = {
  none: "Sin pendientes próximos",
  verde: "Falta alrededor de 2 meses para algún vencimiento",
  amarillo: "Falta alrededor de 1 mes para algún vencimiento",
  naranja: "Falta alrededor de 1 semana para algún vencimiento",
  rojo: "Hay algo vencido",
};

type SemaforoTechnicalSheet = {
  fechaProximoUltrasonido: Date | null;
  fechaProximaInspeccionVisual: Date | null;
  fechaProximaPruebaHermeticidad: Date | null;
  fechaProximaInspeccionVisualInterna: Date | null;
  fechaProximaPruebaHidrostatica: Date | null;
  fechaProximoMantenimiento: Date | null;
  calidadExtintor: string | null;
  fechaCalidadMalaExtintor: Date | null;
  fechaFabricacionManguera: Date | null;
} & ValveDates;

// activo se revisa aparte por quien llama (mismo patrón que el resto de las
// alertas: una unidad dada de baja no tiene pendientes que mostrar).
export function getVehicleSemaforoLevel(
  sheet: SemaforoTechnicalSheet | null | undefined,
  sectionSlug: string,
  // Solo Estaciones/Planta: sus válvulas viven en su propia ficha del tanque
  // (ver lib/station-valves.ts), no en la del vehículo. Normalmente un solo
  // tanque, a veces dos — se toma el más urgente de todos.
  stationTankSheets?: StationValveDates | StationValveDates[] | null
): SemaforoLevel {
  let level: SemaforoLevel = "none";

  const tanques = stationTankSheets
    ? Array.isArray(stationTankSheets)
      ? stationTankSheets
      : [stationTankSheets]
    : [];
  for (const tanque of tanques) {
    const vencimiento = getStationValveVencimiento(tanque);
    if (vencimiento) level = mostUrgent(level, semaforoFromDays(daysUntil(vencimiento)));
  }

  if (!sheet) return level;

  const dateChecks: Array<[AlertType, Date | null]> = [
    ["ultrasonido", sheet.fechaProximoUltrasonido],
    ["visualExterna", sheet.fechaProximaInspeccionVisual],
    ["hermeticidad", sheet.fechaProximaPruebaHermeticidad],
    ["visualInterna", sheet.fechaProximaInspeccionVisualInterna],
    ["hidrostatica", sheet.fechaProximaPruebaHidrostatica],
    ["mantenimiento", sheet.fechaProximoMantenimiento],
    ["valvulas", getValveVencimiento(sheet, aniosVigenciaValvulas(sectionSlug))],
    ["mangueras", getHoseVencimiento(sheet.fechaFabricacionManguera)],
  ];
  for (const [key, fecha] of dateChecks) {
    if (!fecha || !isAlertVisibleForSection(key, sectionSlug)) continue;
    level = mostUrgent(level, semaforoFromDays(daysUntil(fecha)));
  }

  if (isAlertVisibleForSection("extintor", sectionSlug)) {
    const extLevel = getExtinguisherAlertLevel(sheet.calidadExtintor, sheet.fechaCalidadMalaExtintor);
    if (extLevel === "red") level = mostUrgent(level, "rojo");
    else if (extLevel === "yellow") level = mostUrgent(level, "naranja");
  }

  return level;
}
