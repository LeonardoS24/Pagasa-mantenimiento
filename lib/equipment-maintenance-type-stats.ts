import { prisma } from "@/lib/prisma";
import { getCurrentMonthRange } from "@/lib/dates";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";
import type { MonthRange } from "@/lib/piece-maintenance-stats";

export interface EquipmentMaintenanceTypeStat {
  tipo: string;
  total: number;
}

// Orden fijo, igual que MaintenanceTypeStat: Preventivo/Correctivo/Predictivo
// primero (mismos 3 que las unidades) y "Cambio" al final, exclusivo de
// equipos (ver equipmentLogTipoSchema en lib/equipo-enums.ts). Esta gráfica
// combina TODOS los equipos de la ciudad (Planta y estaciones juntos), así
// que también incluye los 5 tipos exclusivos de equipos de Planta (ver
// plantaEquipmentLogTipoSchema) — si no, sus registros desaparecerían del
// desglose en vez de solo mostrarse sin color propio.
const TIPOS: string[] = [
  "Preventivo",
  "Correctivo",
  "Predictivo",
  "Cambio",
  "Inspección",
  "Prueba",
  "Calibración",
  "Reemplazo",
  "Certificación",
];

function cityFilter(cityId: string | null) {
  return cityId ? { section: { cityId } } : { section: { city: { slug: { not: AGGREGATE_CITY_SLUG } } } };
}

// Porcentaje de mantenimientos de equipo por tipo, para la gráfica de pastel
// de Bitácora de equipos (ver components/city/EquipmentMaintenanceTypePieChart.tsx).
// Mismo patrón que getMaintenanceTypeStats: cityId null = Administración
// combinando todas las ciudades.
export async function getEquipmentMaintenanceTypeStats(
  cityId: string | null,
  range: MonthRange = getCurrentMonthRange()
): Promise<EquipmentMaintenanceTypeStat[]> {
  const logs = await prisma.equipmentLog.findMany({
    where: { equipo: cityFilter(cityId), fecha: { gte: range.start, lt: range.end } },
    select: { tipoMantenimiento: true },
  });

  const countByTipo = new Map<string, number>();
  for (const log of logs) {
    countByTipo.set(log.tipoMantenimiento, (countByTipo.get(log.tipoMantenimiento) ?? 0) + 1);
  }

  return TIPOS.map((tipo) => ({ tipo, total: countByTipo.get(tipo) ?? 0 }));
}

export interface EquipmentMaintenanceTypeLogEntry {
  id: string;
  equipoId: string;
  nombreEquipo: string;
  citySlug: string;
  cityName: string;
  fecha: Date;
  descripcion: string;
}

// Desglose de una rebanada del pastel: los mantenimientos concretos de ese
// tipo, con link directo a la bitácora de ese equipo (mismo patrón que
// getMaintenanceLogsForType).
export async function getEquipmentLogsForType(
  cityId: string | null,
  tipoMantenimiento: string,
  range: MonthRange = getCurrentMonthRange()
): Promise<EquipmentMaintenanceTypeLogEntry[]> {
  const logs = await prisma.equipmentLog.findMany({
    where: { equipo: cityFilter(cityId), tipoMantenimiento, fecha: { gte: range.start, lt: range.end } },
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
