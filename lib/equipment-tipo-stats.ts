import { prisma } from "@/lib/prisma";
import { getCurrentMonthRange } from "@/lib/dates";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";
import type { MonthRange } from "@/lib/piece-maintenance-stats";
import { tipoEquipoSchema, type TipoEquipo } from "@/lib/equipo-enums";

export interface EquipmentTipoStat {
  tipoEquipo: TipoEquipo;
  total: number;
}

const TIPOS: TipoEquipo[] = tipoEquipoSchema.options;

function cityFilter(cityId: string | null) {
  return cityId ? { section: { cityId } } : { section: { city: { slug: { not: AGGREGATE_CITY_SLUG } } } };
}

// Mantenimientos de equipo por tipo de EQUIPO (Mecánico/Eléctrico y
// electrónico/Auxiliar, ver lib/equipo-enums.ts), para la gráfica de
// Bitácora de equipos (ver components/city/EquipmentTipoPieChart.tsx).
// Distinto de getEquipmentMaintenanceTypeStats (lib/equipment-maintenance-type-stats.ts),
// que agrupa por tipoMantenimiento (Preventivo/Correctivo/etc): aquí se
// agrupa por el tipo del equipo al que se le hizo el mantenimiento, sin
// importar cuál fue. Mismo alcance que esa función: cityId null =
// Administración combinando todas las ciudades reales.
export async function getEquipmentTipoStats(
  cityId: string | null,
  range: MonthRange = getCurrentMonthRange()
): Promise<EquipmentTipoStat[]> {
  const logs = await prisma.equipmentLog.findMany({
    where: { equipo: cityFilter(cityId), fecha: { gte: range.start, lt: range.end } },
    select: { equipo: { select: { tipoEquipo: true } } },
  });

  const countByTipo = new Map<string, number>();
  for (const log of logs) {
    countByTipo.set(log.equipo.tipoEquipo, (countByTipo.get(log.equipo.tipoEquipo) ?? 0) + 1);
  }

  return TIPOS.map((tipoEquipo) => ({ tipoEquipo, total: countByTipo.get(tipoEquipo) ?? 0 }));
}

export interface EquipmentTipoLogEntry {
  id: string;
  equipoId: string;
  nombreEquipo: string;
  citySlug: string;
  cityName: string;
  fecha: Date;
  descripcion: string;
}

// Desglose de una rebanada del pastel: los mantenimientos concretos hechos
// a equipos de ese tipo, mismo patrón que getEquipmentLogsForType.
export async function getEquipmentLogsForTipo(
  cityId: string | null,
  tipoEquipo: string,
  range: MonthRange = getCurrentMonthRange()
): Promise<EquipmentTipoLogEntry[]> {
  const logs = await prisma.equipmentLog.findMany({
    where: { equipo: { ...cityFilter(cityId), tipoEquipo }, fecha: { gte: range.start, lt: range.end } },
    orderBy: { fecha: "desc" },
    include: {
      equipo: {
        select: { id: true, nombre: true, section: { select: { city: { select: { slug: true, name: true } } } } },
      },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    equipoId: log.equipoId,
    nombreEquipo: log.equipo.nombre,
    citySlug: log.equipo.section.city.slug,
    cityName: log.equipo.section.city.name,
    fecha: log.fecha,
    descripcion: log.descripcion,
  }));
}
