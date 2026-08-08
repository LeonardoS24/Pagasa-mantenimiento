import { prisma } from "@/lib/prisma";
import { getCurrentMonthRange } from "@/lib/dates";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";
import { getExtinguisherChangeStatsByCity, type ExtinguisherChangeCityStat } from "@/lib/extinguisher-change-stats";
import type { MonthRange } from "@/lib/piece-maintenance-stats";

// Mismo shape que ExtinguisherChangeCityStat (lib/extinguisher-change-stats.ts):
// se reutiliza ese tipo en vez de declarar uno idéntico aparte.
export type RecordCountCityStat = ExtinguisherChangeCityStat;

// Los 10 tipos de bitácora de unidad que se comparan entre sí (ver también
// lib/city-unit-log-feed.ts, de donde salen los mismos 10 colorKey). "Dado de
// baja" queda fuera: es un cambio de estatus de la unidad, no un trabajo de
// mantenimiento que tenga sentido comparar contra los demás.
export type RecordTypeKey =
  | "mantenimiento"
  | "ultrasonido"
  | "visualExterna"
  | "hermeticidad"
  | "visualInterna"
  | "hidrostatica"
  | "extintor"
  | "valvulas"
  | "valvulasCorrectivo"
  | "mangueras";

export const RECORD_TYPE_LABELS: Record<RecordTypeKey, string> = {
  mantenimiento: "Mantenimiento",
  ultrasonido: "Ultrasonido",
  visualExterna: "Inspección Visual Externa",
  hermeticidad: "Prueba de Hermeticidad",
  visualInterna: "Inspección Visual Interna",
  hidrostatica: "Prueba Hidrostática",
  extintor: "Cambio de Extintor",
  valvulas: "Cambio de Válvulas",
  valvulasCorrectivo: "Mantenimiento correctivo de válvulas",
  mangueras: "Cambio de Mangueras",
};

// Mismo color por tipo que ya se usa en badges/bordes de la bitácora de
// unidades (ver lib/section-colors.ts), en hex para usarlo directo en SVG.
export const RECORD_TYPE_COLORS: Record<RecordTypeKey, string> = {
  mantenimiento: "#059669", // emerald-600
  ultrasonido: "#0891B2", // cyan-600
  visualExterna: "#9333EA", // purple-600
  hermeticidad: "#C026D3", // fuchsia-600
  visualInterna: "#7C3AED", // violet-600
  hidrostatica: "#2563EB", // blue-600
  extintor: "#DC2626", // red-600
  valvulas: "#4F46E5", // indigo-600
  valvulasCorrectivo: "#4F46E5", // indigo-600 (mismo colorKey "valvulas" que el cambio)
  mangueras: "#D97706", // amber-600
};

const cityIdSelect = {
  vehicleRecord: { select: { section: { select: { cityId: true } } } },
} as const;

async function statsByCity(
  logs: { vehicleRecord: { section: { cityId: string } } }[]
): Promise<RecordCountCityStat[]> {
  const cities = await prisma.city.findMany({
    where: { slug: { not: AGGREGATE_CITY_SLUG } },
    orderBy: { order: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const countByCityId = new Map<string, number>();
  for (const log of logs) {
    const cityId = log.vehicleRecord.section.cityId;
    countByCityId.set(cityId, (countByCityId.get(cityId) ?? 0) + 1);
  }

  return cities
    .map((city) => ({
      cityId: city.id,
      cityName: city.name,
      citySlug: city.slug,
      total: countByCityId.get(city.id) ?? 0,
    }))
    .sort((a, b) => b.total - a.total);
}

export async function getMantenimientoStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<RecordCountCityStat[]> {
  const logs = await prisma.maintenanceLog.findMany({
    where: { fecha: { gte: range.start, lt: range.end } },
    select: cityIdSelect,
  });
  return statsByCity(logs);
}

export async function getUltrasonidoStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<RecordCountCityStat[]> {
  const logs = await prisma.ultrasoundLog.findMany({
    where: { fechaRealizacion: { gte: range.start, lt: range.end } },
    select: cityIdSelect,
  });
  return statsByCity(logs);
}

export async function getVisualExternaStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<RecordCountCityStat[]> {
  const logs = await prisma.visualInspectionLog.findMany({
    where: { fechaRealizacion: { gte: range.start, lt: range.end } },
    select: cityIdSelect,
  });
  return statsByCity(logs);
}

export async function getHermeticidadStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<RecordCountCityStat[]> {
  const logs = await prisma.tightnessTestLog.findMany({
    where: { fechaRealizacion: { gte: range.start, lt: range.end } },
    select: cityIdSelect,
  });
  return statsByCity(logs);
}

export async function getVisualInternaStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<RecordCountCityStat[]> {
  const logs = await prisma.internalVisualInspectionLog.findMany({
    where: { fechaRealizacion: { gte: range.start, lt: range.end } },
    select: cityIdSelect,
  });
  return statsByCity(logs);
}

export async function getHidrostaticaStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<RecordCountCityStat[]> {
  const logs = await prisma.hydrostaticTestLog.findMany({
    where: { fechaRealizacion: { gte: range.start, lt: range.end } },
    select: cityIdSelect,
  });
  return statsByCity(logs);
}

export async function getValvulasStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<RecordCountCityStat[]> {
  const logs = await prisma.valveChangeLog.findMany({
    where: { fechaInstalacion: { gte: range.start, lt: range.end } },
    select: cityIdSelect,
  });
  return statsByCity(logs);
}

export async function getValvulasCorrectivoStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<RecordCountCityStat[]> {
  const logs = await prisma.valveCorrectiveMaintenanceLog.findMany({
    where: { fecha: { gte: range.start, lt: range.end } },
    select: cityIdSelect,
  });
  return statsByCity(logs);
}

export async function getManguerasStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<RecordCountCityStat[]> {
  const logs = await prisma.hoseChangeLog.findMany({
    where: { fechaInstalacion: { gte: range.start, lt: range.end } },
    select: cityIdSelect,
  });
  return statsByCity(logs);
}

export interface RecordTypeStats {
  type: RecordTypeKey;
  label: string;
  color: string;
  total: number;
  byCity: RecordCountCityStat[];
}

// Junta los 10 tipos ya calculados (ver getAllRecordTypeStats) en una sola
// lista ordenada por total descendente: responde "cuál se hizo más en
// general" (total) y "cuál se hizo más por ciudad" (byCity, mismo orden de
// ciudades en los 10 arreglos porque todos salen de statsByCity).
function buildComparison(
  entries: { type: RecordTypeKey; stats: RecordCountCityStat[] }[]
): RecordTypeStats[] {
  return entries
    .map(({ type, stats }) => ({
      type,
      label: RECORD_TYPE_LABELS[type],
      color: RECORD_TYPE_COLORS[type],
      total: stats.reduce((sum, s) => sum + s.total, 0),
      byCity: stats,
    }))
    .sort((a, b) => b.total - a.total);
}

// Un solo punto de entrada que trae los 10 tipos a la vez (Promise.all) y ya
// los deja listos tanto para los 10 gráficos "por ciudad" individuales como
// para la comparación general (ver components/city/RecordTypeComparisonSection.tsx).
export async function getAllRecordTypeStats(
  range: MonthRange = getCurrentMonthRange()
): Promise<RecordTypeStats[]> {
  const [
    mantenimiento,
    ultrasonido,
    visualExterna,
    hermeticidad,
    visualInterna,
    hidrostatica,
    extintor,
    valvulas,
    valvulasCorrectivo,
    mangueras,
  ] = await Promise.all([
    getMantenimientoStatsByCity(range),
    getUltrasonidoStatsByCity(range),
    getVisualExternaStatsByCity(range),
    getHermeticidadStatsByCity(range),
    getVisualInternaStatsByCity(range),
    getHidrostaticaStatsByCity(range),
    getExtinguisherChangeStatsByCity(range),
    getValvulasStatsByCity(range),
    getValvulasCorrectivoStatsByCity(range),
    getManguerasStatsByCity(range),
  ]);

  return buildComparison([
    { type: "mantenimiento", stats: mantenimiento },
    { type: "ultrasonido", stats: ultrasonido },
    { type: "visualExterna", stats: visualExterna },
    { type: "hermeticidad", stats: hermeticidad },
    { type: "visualInterna", stats: visualInterna },
    { type: "hidrostatica", stats: hidrostatica },
    { type: "extintor", stats: extintor },
    { type: "valvulas", stats: valvulas },
    { type: "valvulasCorrectivo", stats: valvulasCorrectivo },
    { type: "mangueras", stats: mangueras },
  ]);
}
