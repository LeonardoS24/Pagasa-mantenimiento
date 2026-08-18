import type { StationTankTechnicalSheet } from "@prisma/client";
import { prisma } from "./prisma";
import { isAlertVisibleForSection, type AlertType } from "./alert-visibility";
import { getValveVencimiento, type ValveDates } from "./valve-alerts";
import { getHoseVencimiento } from "./hose-alerts";
import { getStationValveVencimiento } from "./station-valves";
import { ESTACION_LIKE_SECTION_SLUGS } from "./estacion-sections";

// A qué ámbito pertenece el resumen: una unidad normal o una Estación de
// carburación/Planta (ver ESTACION_LIKE_SECTION_SLUGS). Ambas cuentan con las
// mismas 5 inspecciones periódicas (viven igual en VehicleTechnicalSheet),
// pero "valvulas" es un juego totalmente distinto en cada una (ver
// lib/valve-alerts.ts vs lib/station-valves.ts), y extintor/mangueras no
// aplican a una estación fija.
export type ResumenAmbito = "UNIDADES" | "ESTACIONES";

// Resumen anual de "Administración": a diferencia de lib/vehicle-alerts-summary.ts
// (que solo mira los próximos 30 días para las alertas de Inicio), este
// módulo junta TODO lo que vence este año calendario (incluido lo ya
// vencido de años anteriores que sigue sin registrarse) para poder
// planearlo con tiempo, más lo que no tiene fecha capturada y por eso ni
// siquiera puede ubicarse en el calendario.
export type YearlySummaryTypeId =
  | "extintor"
  | "ultrasonido"
  | "visualExterna"
  | "visualInterna"
  | "hermeticidad"
  | "hidrostatica"
  | "valvulas"
  | "mangueras";

export const YEARLY_SUMMARY_TYPES: YearlySummaryTypeId[] = [
  "extintor",
  "ultrasonido",
  "visualExterna",
  "visualInterna",
  "hermeticidad",
  "hidrostatica",
  "valvulas",
  "mangueras",
];

// Sin extintor ni mangueras: una estación fija no los tiene.
export const STATION_SUMMARY_TYPES: YearlySummaryTypeId[] = [
  "ultrasonido",
  "visualExterna",
  "visualInterna",
  "hermeticidad",
  "hidrostatica",
  "valvulas",
];

export function summaryTypesForAmbito(ambito: ResumenAmbito): YearlySummaryTypeId[] {
  return ambito === "ESTACIONES" ? STATION_SUMMARY_TYPES : YEARLY_SUMMARY_TYPES;
}

// Los 5 tipos que, para una estación/planta con más de un tanque físico,
// viven por separado en cada StationTankTechnicalSheet en vez de en la ficha
// compartida (ver app/(protected)/ciudades/[citySlug]/vehiculo/[vehicleId]/page.tsx
// e isMultiTanque ahí) — "valvulas" ya tenía su propio manejo por tanque
// aparte, y extintor/mangueras no aplican a una estación fija.
const INSPECTION_TYPES_WITH_TANK: YearlySummaryTypeId[] = [
  "ultrasonido",
  "visualExterna",
  "visualInterna",
  "hermeticidad",
  "hidrostatica",
];

// Clave para juntar bitácoras con su tanque: sin tanque (estación de un solo
// tanque, o cualquier tipo/ámbito que no aplique) usa solo el id del
// registro, igual que siempre.
function tankLogKey(vehicleRecordId: string, stationTankTechnicalSheetId?: string | null): string {
  return stationTankTechnicalSheetId ? `${vehicleRecordId}:${stationTankTechnicalSheetId}` : vehicleRecordId;
}

export const yearlySummaryLabels: Record<YearlySummaryTypeId, string> = {
  extintor: "Cambio de Extintor",
  ultrasonido: "Ultrasonido",
  visualExterna: "Inspección Visual Externa",
  visualInterna: "Inspección Visual Interna",
  hermeticidad: "Prueba de Hermeticidad",
  hidrostatica: "Prueba Hidrostática",
  valvulas: "Cambio de Válvulas",
  mangueras: "Cambio de Mangueras",
};

// Slug usado en el query param ?tab= de cada pestaña (ver components/admin/ResumenPanel.tsx).
export const yearlySummaryRouteSlugs: Record<YearlySummaryTypeId, string> = {
  extintor: "extintor",
  ultrasonido: "ultrasonido",
  visualExterna: "visual-externa",
  visualInterna: "visual-interna",
  hermeticidad: "hermeticidad",
  hidrostatica: "hidrostatica",
  valvulas: "valvulas",
  mangueras: "mangueras",
};

// Mismo filtro de visibilidad que las alertas de Inicio (ver
// lib/alert-visibility.ts), para no repetir la misma unidad dos veces
// cuando vive en dos apartados pareados (Auto-Tanques / Vehículo con
// tanque de carburación).
const ALERT_TYPE_FOR_SUMMARY_TYPE: Record<YearlySummaryTypeId, AlertType> = {
  extintor: "extintor",
  ultrasonido: "ultrasonido",
  visualExterna: "visualExterna",
  visualInterna: "visualInterna",
  hermeticidad: "hermeticidad",
  hidrostatica: "hidrostatica",
  valvulas: "valvulas",
  mangueras: "mangueras",
};

// Ancla de la ficha técnica de la unidad a la que debe llevar el link de
// cada renglón (mismos id= que app/(protected)/ciudades/[citySlug]/vehiculo/[vehicleId]/page.tsx).
export const yearlySummaryAnchors: Record<YearlySummaryTypeId, string> = {
  extintor: "extintor",
  ultrasonido: "ultrasonido",
  visualExterna: "visual-externa",
  visualInterna: "visual-interna",
  hermeticidad: "hermeticidad",
  hidrostatica: "hidrostatica",
  valvulas: "valvulas",
  mangueras: "mangueras",
};

export interface YearlySummaryItem {
  id: string;
  numeroEconomico: string;
  sectionSlug: string;
  citySlug: string;
  cityName: string;
  dueDate: Date | null;
}

export interface YearlySummaryCompletedItem extends YearlySummaryItem {
  fechaRegistro: Date;
}

export interface YearlySummaryResult {
  due: YearlySummaryItem[];
  missing: YearlySummaryItem[];
  completed: YearlySummaryCompletedItem[];
}

type TechnicalSheetLike = {
  fechaVencimientoExtintor: Date | null;
  fechaProximoUltrasonido: Date | null;
  fechaProximaInspeccionVisual: Date | null;
  fechaProximaInspeccionVisualInterna: Date | null;
  fechaProximaPruebaHermeticidad: Date | null;
  fechaProximaPruebaHidrostatica: Date | null;
  fechaFabricacionValvulaLlenado: Date | null;
  fechaFabricacionValvulaNoRetroceso: Date | null;
  fechaFabricacionValvulaBypass: Date | null;
  fechaFabricacionValvulaRetornoVapores: Date | null;
  fechaFabricacionValvulaServicio: Date | null;
  fechaFabricacionValvulaMaximoLlenado: Date | null;
  fechaFabricacionValvulaMaximoLlenado85: Date | null;
  fechaFabricacionValvulaAlivio: Date | null;
  fechaFabricacionValvulaDescargaEmergencia: Date | null;
  fechaFabricacionManguera: Date | null;
} | null;

function getDueDate(
  type: YearlySummaryTypeId,
  sheet: TechnicalSheetLike,
  ambito: ResumenAmbito,
  stationSheet?: StationTankTechnicalSheet | null,
  useTankFields?: boolean
): Date | null {
  if (type === "valvulas" && ambito === "ESTACIONES") {
    return stationSheet ? getStationValveVencimiento(stationSheet) : null;
  }
  // Estación/planta con varios tanques: para estos 5 tipos, cada tanque
  // agenda su propia fecha próxima (ver StationTankTechnicalSheet), no la
  // ficha compartida del registro.
  if (useTankFields) {
    if (!stationSheet) return null;
    switch (type) {
      case "ultrasonido":
        return stationSheet.fechaProximoUltrasonido;
      case "visualExterna":
        return stationSheet.fechaProximaInspeccionVisual;
      case "visualInterna":
        return stationSheet.fechaProximaInspeccionVisualInterna;
      case "hermeticidad":
        return stationSheet.fechaProximaPruebaHermeticidad;
      case "hidrostatica":
        return stationSheet.fechaProximaPruebaHidrostatica;
      default:
        return null;
    }
  }
  if (!sheet) return null;
  switch (type) {
    case "extintor":
      return sheet.fechaVencimientoExtintor;
    case "ultrasonido":
      return sheet.fechaProximoUltrasonido;
    case "visualExterna":
      return sheet.fechaProximaInspeccionVisual;
    case "visualInterna":
      return sheet.fechaProximaInspeccionVisualInterna;
    case "hermeticidad":
      return sheet.fechaProximaPruebaHermeticidad;
    case "hidrostatica":
      return sheet.fechaProximaPruebaHidrostatica;
    case "valvulas": {
      const dates: ValveDates = {
        fechaFabricacionValvulaLlenado: sheet.fechaFabricacionValvulaLlenado,
        fechaFabricacionValvulaNoRetroceso: sheet.fechaFabricacionValvulaNoRetroceso,
        fechaFabricacionValvulaBypass: sheet.fechaFabricacionValvulaBypass,
        fechaFabricacionValvulaRetornoVapores: sheet.fechaFabricacionValvulaRetornoVapores,
        fechaFabricacionValvulaServicio: sheet.fechaFabricacionValvulaServicio,
        fechaFabricacionValvulaMaximoLlenado: sheet.fechaFabricacionValvulaMaximoLlenado,
        fechaFabricacionValvulaMaximoLlenado85: sheet.fechaFabricacionValvulaMaximoLlenado85,
        fechaFabricacionValvulaAlivio: sheet.fechaFabricacionValvulaAlivio,
        fechaFabricacionValvulaDescargaEmergencia: sheet.fechaFabricacionValvulaDescargaEmergencia,
      };
      return getValveVencimiento(dates);
    }
    case "mangueras":
      return getHoseVencimiento(sheet.fechaFabricacionManguera);
  }
}

// Fecha de cada log ya existente en el año dado, la más reciente por unidad
// si hubiera más de una. Cada tipo vive en su propio modelo (ver
// prisma/schema.prisma), así que no hay forma de generalizar esto en una
// sola consulta Prisma.
async function getLogDatesThisYear(
  type: YearlySummaryTypeId,
  vehicleIds: string[],
  yearStart: Date,
  yearEnd: Date,
  ambito: ResumenAmbito
): Promise<Map<string, Date>> {
  if (vehicleIds.length === 0) return new Map();
  // El juego de válvulas de una estación (ver lib/station-valves.ts) no
  // tiene una bitácora propia de cambios: las fechas se sobrescriben
  // directo en StationTankTechnicalSheet. Sin log no hay forma de saber si
  // ya se registró un cambio este año, así que ese tipo siempre queda como
  // "vence"/"sin información", nunca "ya registrado".
  if (type === "valvulas" && ambito === "ESTACIONES") return new Map();

  const where = { vehicleRecordId: { in: vehicleIds } };
  // Los 5 tipos con tanque (ver INSPECTION_TYPES_WITH_TANK) sí guardan
  // stationTankTechnicalSheetId en su bitácora: para una estación/planta con
  // varios tanques, la fecha "ya registrada" hay que juntarla por tanque, no
  // por registro completo (ver tankLogKey).
  let rows: { key: string; fecha: Date }[];

  switch (type) {
    case "extintor":
      rows = (
        await prisma.extinguisherChangeLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ key: r.vehicleRecordId, fecha: r.fechaRealizacion }));
      break;
    case "ultrasonido":
      rows = (
        await prisma.ultrasoundLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, stationTankTechnicalSheetId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ key: tankLogKey(r.vehicleRecordId, r.stationTankTechnicalSheetId), fecha: r.fechaRealizacion }));
      break;
    case "visualExterna":
      rows = (
        await prisma.visualInspectionLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, stationTankTechnicalSheetId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ key: tankLogKey(r.vehicleRecordId, r.stationTankTechnicalSheetId), fecha: r.fechaRealizacion }));
      break;
    case "visualInterna":
      rows = (
        await prisma.internalVisualInspectionLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, stationTankTechnicalSheetId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ key: tankLogKey(r.vehicleRecordId, r.stationTankTechnicalSheetId), fecha: r.fechaRealizacion }));
      break;
    case "hermeticidad":
      rows = (
        await prisma.tightnessTestLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, stationTankTechnicalSheetId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ key: tankLogKey(r.vehicleRecordId, r.stationTankTechnicalSheetId), fecha: r.fechaRealizacion }));
      break;
    case "hidrostatica":
      rows = (
        await prisma.hydrostaticTestLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, stationTankTechnicalSheetId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ key: tankLogKey(r.vehicleRecordId, r.stationTankTechnicalSheetId), fecha: r.fechaRealizacion }));
      break;
    case "valvulas":
      rows = (
        await prisma.valveChangeLog.findMany({
          where: { ...where, fechaInstalacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, fechaInstalacion: true },
          orderBy: { fechaInstalacion: "desc" },
        })
      ).map((r) => ({ key: r.vehicleRecordId, fecha: r.fechaInstalacion }));
      break;
    case "mangueras":
      rows = (
        await prisma.hoseChangeLog.findMany({
          where: { ...where, fechaInstalacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, fechaInstalacion: true },
          orderBy: { fechaInstalacion: "desc" },
        })
      ).map((r) => ({ key: r.vehicleRecordId, fecha: r.fechaInstalacion }));
      break;
  }

  const map = new Map<string, Date>();
  for (const row of rows) {
    // orderBy desc: la primera vez que se ve una clave es su fecha más reciente.
    if (!map.has(row.key)) map.set(row.key, row.fecha);
  }
  return map;
}

// Para un tipo y un conjunto de ciudades, separa las unidades activas en
// tres grupos: due (vence este año o ya venció y sigue sin registrarse),
// missing (nunca se capturó la fecha, no se puede ni ubicar en el
// calendario) y completed (ya se registró un cambio nuevo este año, sin
// importar que la fecha recalculada haya quedado fuera de este año).
export async function getYearlySummary(
  type: YearlySummaryTypeId,
  cityIds: string[],
  year: number,
  ambito: ResumenAmbito = "UNIDADES"
): Promise<YearlySummaryResult> {
  if (cityIds.length === 0) return { due: [], missing: [], completed: [] };
  // extintor/mangueras no aplican a una estación fija (ver comentario en
  // STATION_SUMMARY_TYPES); nada que resumir en ese cruce.
  if (ambito === "ESTACIONES" && (type === "extintor" || type === "mangueras")) {
    return { due: [], missing: [], completed: [] };
  }

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const alertType = ALERT_TYPE_FOR_SUMMARY_TYPE[type];

  const vehicles = await prisma.vehicleRecord.findMany({
    where: { activo: true, section: { cityId: { in: cityIds } } },
    include: {
      technicalSheet: true,
      stationTankTechnicalSheets: true,
      section: { include: { city: true } },
    },
  });

  const inScope = vehicles.filter((v) => {
    if (!isAlertVisibleForSection(alertType, v.section.slug)) return false;
    const esEstacion = ESTACION_LIKE_SECTION_SLUGS.includes(v.section.slug);
    return ambito === "ESTACIONES" ? esEstacion : !esEstacion;
  });
  const logDates = await getLogDatesThisYear(
    type,
    inScope.map((v) => v.id),
    yearStart,
    yearEnd,
    ambito
  );

  const due: YearlySummaryItem[] = [];
  const missing: YearlySummaryItem[] = [];
  const completed: YearlySummaryCompletedItem[] = [];

  for (const v of inScope) {
    const isMultiTanqueRecord = v.stationTankTechnicalSheets.length > 1;
    // Cuándo se abre un renglón por tanque en vez de uno por registro:
    // válvulas de estación siempre (juego propio de cada tanque, ver
    // lib/station-valves.ts), y los 5 tipos de inspección solo cuando el
    // registro de verdad tiene más de un tanque (con uno solo, la fecha
    // sigue viviendo en la ficha compartida, igual que siempre).
    const useTankFields =
      ambito === "ESTACIONES" && INSPECTION_TYPES_WITH_TANK.includes(type) && isMultiTanqueRecord;
    const usesTankLoop = ambito === "ESTACIONES" && (type === "valvulas" || useTankFields);

    const tanques: (StationTankTechnicalSheet | null)[] = usesTankLoop
      ? v.stationTankTechnicalSheets.length > 0
        ? v.stationTankTechnicalSheets
        : [null]
      : [v.stationTankTechnicalSheets[0] ?? null];

    for (const tanque of tanques) {
      const sufijo = tanques.length > 1 && tanque ? ` (${tanque.etiqueta})` : "";
      const base = {
        id: v.id,
        numeroEconomico: `${v.numeroEconomico}${sufijo}`,
        sectionSlug: v.section.slug,
        citySlug: v.section.city.slug,
        cityName: v.section.city.name,
      };
      const dueDate = getDueDate(type, v.technicalSheet, ambito, tanque, useTankFields);
      const fechaRegistro = logDates.get(useTankFields && tanque ? tankLogKey(v.id, tanque.id) : v.id);

      if (fechaRegistro) {
        completed.push({ ...base, dueDate, fechaRegistro });
      } else if (dueDate && dueDate.getTime() < yearEnd.getTime()) {
        due.push({ ...base, dueDate });
      } else if (!dueDate) {
        missing.push({ ...base, dueDate: null });
      }
    }
  }

  due.sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
  completed.sort((a, b) => b.fechaRegistro.getTime() - a.fechaRegistro.getTime());

  return { due, missing, completed };
}

export interface YearlySummaryOverviewRow {
  type: YearlySummaryTypeId;
  label: string;
  due: number;
  missing: number;
  completed: number;
}

// Conteos de los tipos del ámbito para la pestaña "Resumen general".
export async function getYearlySummaryOverview(
  cityIds: string[],
  year: number,
  ambito: ResumenAmbito = "UNIDADES"
): Promise<YearlySummaryOverviewRow[]> {
  const types = summaryTypesForAmbito(ambito);
  const results = await Promise.all(types.map((type) => getYearlySummary(type, cityIds, year, ambito)));
  return types.map((type, i) => ({
    type,
    label: yearlySummaryLabels[type],
    due: results[i].due.length,
    missing: results[i].missing.length,
    completed: results[i].completed.length,
  }));
}

export interface YearlySummaryMissingGroup {
  type: YearlySummaryTypeId;
  label: string;
  items: YearlySummaryItem[];
}

// Los "sin información" de los tipos del ámbito juntos, agrupados por tipo,
// para la pestaña "Sin información".
export async function getYearlySummaryAllMissing(
  cityIds: string[],
  year: number,
  ambito: ResumenAmbito = "UNIDADES"
): Promise<YearlySummaryMissingGroup[]> {
  const types = summaryTypesForAmbito(ambito);
  const results = await Promise.all(types.map((type) => getYearlySummary(type, cityIds, year, ambito)));
  return types.map((type, i) => ({
    type,
    label: yearlySummaryLabels[type],
    items: results[i].missing,
  })).filter((group) => group.items.length > 0);
}
