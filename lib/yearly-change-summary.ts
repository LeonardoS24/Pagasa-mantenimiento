import { prisma } from "./prisma";
import { isAlertVisibleForSection, type AlertType } from "./alert-visibility";
import { getValveVencimiento, type ValveDates } from "./valve-alerts";
import { getHoseVencimiento } from "./hose-alerts";

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

function getDueDate(type: YearlySummaryTypeId, sheet: TechnicalSheetLike): Date | null {
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
  yearEnd: Date
): Promise<Map<string, Date>> {
  if (vehicleIds.length === 0) return new Map();

  const where = { vehicleRecordId: { in: vehicleIds } };
  let rows: { vehicleRecordId: string; fecha: Date }[];

  switch (type) {
    case "extintor":
      rows = (
        await prisma.extinguisherChangeLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ vehicleRecordId: r.vehicleRecordId, fecha: r.fechaRealizacion }));
      break;
    case "ultrasonido":
      rows = (
        await prisma.ultrasoundLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ vehicleRecordId: r.vehicleRecordId, fecha: r.fechaRealizacion }));
      break;
    case "visualExterna":
      rows = (
        await prisma.visualInspectionLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ vehicleRecordId: r.vehicleRecordId, fecha: r.fechaRealizacion }));
      break;
    case "visualInterna":
      rows = (
        await prisma.internalVisualInspectionLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ vehicleRecordId: r.vehicleRecordId, fecha: r.fechaRealizacion }));
      break;
    case "hermeticidad":
      rows = (
        await prisma.tightnessTestLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ vehicleRecordId: r.vehicleRecordId, fecha: r.fechaRealizacion }));
      break;
    case "hidrostatica":
      rows = (
        await prisma.hydrostaticTestLog.findMany({
          where: { ...where, fechaRealizacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, fechaRealizacion: true },
          orderBy: { fechaRealizacion: "desc" },
        })
      ).map((r) => ({ vehicleRecordId: r.vehicleRecordId, fecha: r.fechaRealizacion }));
      break;
    case "valvulas":
      rows = (
        await prisma.valveChangeLog.findMany({
          where: { ...where, fechaInstalacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, fechaInstalacion: true },
          orderBy: { fechaInstalacion: "desc" },
        })
      ).map((r) => ({ vehicleRecordId: r.vehicleRecordId, fecha: r.fechaInstalacion }));
      break;
    case "mangueras":
      rows = (
        await prisma.hoseChangeLog.findMany({
          where: { ...where, fechaInstalacion: { gte: yearStart, lt: yearEnd } },
          select: { vehicleRecordId: true, fechaInstalacion: true },
          orderBy: { fechaInstalacion: "desc" },
        })
      ).map((r) => ({ vehicleRecordId: r.vehicleRecordId, fecha: r.fechaInstalacion }));
      break;
  }

  const map = new Map<string, Date>();
  for (const row of rows) {
    // orderBy desc: la primera vez que se ve una unidad es su fecha más reciente.
    if (!map.has(row.vehicleRecordId)) map.set(row.vehicleRecordId, row.fecha);
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
  year: number
): Promise<YearlySummaryResult> {
  if (cityIds.length === 0) return { due: [], missing: [], completed: [] };

  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
  const alertType = ALERT_TYPE_FOR_SUMMARY_TYPE[type];

  const vehicles = await prisma.vehicleRecord.findMany({
    where: { activo: true, section: { cityId: { in: cityIds } } },
    include: { technicalSheet: true, section: { include: { city: true } } },
  });

  const inScope = vehicles.filter((v) => isAlertVisibleForSection(alertType, v.section.slug));
  const logDates = await getLogDatesThisYear(
    type,
    inScope.map((v) => v.id),
    yearStart,
    yearEnd
  );

  const due: YearlySummaryItem[] = [];
  const missing: YearlySummaryItem[] = [];
  const completed: YearlySummaryCompletedItem[] = [];

  for (const v of inScope) {
    const base = {
      id: v.id,
      numeroEconomico: v.numeroEconomico,
      citySlug: v.section.city.slug,
      cityName: v.section.city.name,
    };
    const fechaRegistro = logDates.get(v.id);
    const dueDate = getDueDate(type, v.technicalSheet);

    if (fechaRegistro) {
      completed.push({ ...base, dueDate, fechaRegistro });
    } else if (dueDate && dueDate.getTime() < yearEnd.getTime()) {
      due.push({ ...base, dueDate });
    } else if (!dueDate) {
      missing.push({ ...base, dueDate: null });
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

// Conteos de los 8 tipos para la pestaña "Resumen general".
export async function getYearlySummaryOverview(
  cityIds: string[],
  year: number
): Promise<YearlySummaryOverviewRow[]> {
  const results = await Promise.all(
    YEARLY_SUMMARY_TYPES.map((type) => getYearlySummary(type, cityIds, year))
  );
  return YEARLY_SUMMARY_TYPES.map((type, i) => ({
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

// Los "sin información" de los 8 tipos juntos, agrupados por tipo, para la
// pestaña "Sin información".
export async function getYearlySummaryAllMissing(
  cityIds: string[],
  year: number
): Promise<YearlySummaryMissingGroup[]> {
  const results = await Promise.all(
    YEARLY_SUMMARY_TYPES.map((type) => getYearlySummary(type, cityIds, year))
  );
  return YEARLY_SUMMARY_TYPES.map((type, i) => ({
    type,
    label: yearlySummaryLabels[type],
    items: results[i].missing,
  })).filter((group) => group.items.length > 0);
}
