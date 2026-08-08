import { prisma } from "@/lib/prisma";
import { accionPiezaOptions, type AccionPieza } from "@/lib/piece-catalog";
import { getCurrentMonthRange } from "@/lib/dates";

export type MonthRange = { start: Date; end: Date };

export interface PieceMaintenanceStat {
  categoria: string | null;
  pieza: string;
  total: number;
  porAccion: Record<AccionPieza, number>;
}

// Cuenta, por pieza, cuántos mantenimientos tuvo desglosados por acción
// (Sustitución / Reparación / Mantenimiento preventivo). Solo cuentan los
// registros donde se capturó tanto la pieza como la acción (campo nuevo, ver
// components/admin/CreateMaintenanceLogForm.tsx): los mantenimientos previos
// a este cambio no tienen esa acción y no entran al desglose.
//
// Se agrupa por categoría + pieza, no solo por el nombre de la pieza: varios
// nombres se repiten en categorías distintas con significados distintos
// (p. ej. "Mangueras" existe en Combustible, Enfriamiento y Aire
// Acondicionado; "Válvulas" existe en Motor y en Llantas y Rines). Agrupar
// solo por nombre mezclaría mantenimientos de piezas que no tienen nada que
// ver entre sí.
//
// El gráfico se reinicia cada mes: solo cuenta mantenimientos con fecha
// dentro del mes en curso. Los registros en sí no se borran (siguen en el
// historial y en la impresión), solo se acota lo que entra al gráfico.
//
// cityId null = todas las ciudades combinadas (ver el apartado
// "Administración", lib/aggregate-city.ts). Si se da vehicleRecordId, acota a
// una sola unidad (ver el gráfico propio de cada vehículo) y cityId se
// ignora. range es opcional: por default es el mes en curso, pero el
// selector de mes de Administración puede pedir cualquier otro ya pasado
// (ver lib/dates.ts: getMonthRange), y el gráfico por unidad usa un rango de
// año en vez de mes (ver lib/dates.ts: getYearRange).
export async function getPieceMaintenanceStats(
  cityId: string | null,
  limit = 10,
  range: MonthRange = getCurrentMonthRange(),
  vehicleRecordId?: string
): Promise<PieceMaintenanceStat[]> {
  const { start, end } = range;
  const logs = await prisma.maintenanceLog.findMany({
    where: {
      vehicleRecord: vehicleRecordId ? { id: vehicleRecordId } : cityId ? { section: { cityId } } : {},
      pieza: { not: null },
      accionPieza: { not: null },
      fecha: { gte: start, lt: end },
    },
    select: { categoriaPieza: true, pieza: true, accionPieza: true },
  });

  const byKey = new Map<string, PieceMaintenanceStat>();
  for (const log of logs) {
    const pieza = log.pieza!;
    const categoria = log.categoriaPieza;
    const accion = log.accionPieza as AccionPieza;
    if (!accionPiezaOptions.includes(accion)) continue;
    const key = `${categoria ?? ""}::${pieza}`;
    let stat = byKey.get(key);
    if (!stat) {
      stat = {
        categoria,
        pieza,
        total: 0,
        porAccion: { Sustitución: 0, Reparación: 0, "Mantenimiento preventivo": 0 },
      };
      byKey.set(key, stat);
    }
    stat.porAccion[accion] += 1;
    stat.total += 1;
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

export interface PieceMaintenanceLogEntry {
  id: string;
  vehicleRecordId: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  fecha: Date;
  accion: AccionPieza;
  tipoServicio: string;
}

// Desglose de getPieceMaintenanceStats: los mantenimientos concretos detrás
// del total de una fila del gráfico (ver PieceMaintenanceChart), para que se
// pueda entrar directo a la unidad y ver ese registro. Mismo filtro exacto
// que la función de arriba (categoría + pieza + acción capturada + rango de
// fecha) para que el desglose sume igual que la barra en la que se hizo clic.
export async function getMaintenanceLogsForPiece(
  cityId: string | null,
  categoria: string | null,
  pieza: string,
  range: MonthRange = getCurrentMonthRange(),
  vehicleRecordId?: string
): Promise<PieceMaintenanceLogEntry[]> {
  const { start, end } = range;
  const logs = await prisma.maintenanceLog.findMany({
    where: {
      vehicleRecord: vehicleRecordId ? { id: vehicleRecordId } : cityId ? { section: { cityId } } : {},
      categoriaPieza: categoria,
      pieza,
      accionPieza: { not: null },
      fecha: { gte: start, lt: end },
    },
    orderBy: { fecha: "desc" },
    include: {
      vehicleRecord: {
        select: {
          numeroEconomico: true,
          section: { select: { city: { select: { slug: true, name: true } } } },
        },
      },
    },
  });

  return logs
    .filter((log) => accionPiezaOptions.includes(log.accionPieza as AccionPieza))
    .map((log) => ({
      id: log.id,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      fecha: log.fecha,
      accion: log.accionPieza as AccionPieza,
      tipoServicio: log.tipoServicio,
    }));
}
