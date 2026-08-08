import { prisma } from "@/lib/prisma";
import { getCurrentMonthRange } from "@/lib/dates";
import type { MonthRange } from "@/lib/piece-maintenance-stats";

export interface MaintenanceTypeStat {
  tipo: string;
  total: number;
}

// Orden fijo (no alfabético): así el pastel y la leyenda siempre muestran
// Preventivo primero, sin importar cuál tenga más registros ese mes.
const TIPOS: string[] = ["Preventivo", "Correctivo", "Predictivo"];

// Porcentaje de mantenimientos por tipo (Preventivo/Correctivo/Predictivo),
// para la gráfica de pastel de Bitácora de unidades (ver
// components/city/MaintenanceTypePieChart.tsx). Mismo alcance que el resto de
// las gráficas de ahí: cityId null = Administración combinando todas las
// ciudades; vehicleRecordId, si se da, acota a una sola unidad.
export async function getMaintenanceTypeStats(
  cityId: string | null,
  range: MonthRange = getCurrentMonthRange(),
  vehicleRecordId?: string
): Promise<MaintenanceTypeStat[]> {
  const logs = await prisma.maintenanceLog.findMany({
    where: {
      vehicleRecord: vehicleRecordId ? { id: vehicleRecordId } : cityId ? { section: { cityId } } : {},
      fecha: { gte: range.start, lt: range.end },
    },
    select: { tipoMantenimiento: true },
  });

  const countByTipo = new Map<string, number>();
  for (const log of logs) {
    countByTipo.set(log.tipoMantenimiento, (countByTipo.get(log.tipoMantenimiento) ?? 0) + 1);
  }

  // Siempre los 3 tipos, aunque alguno esté en 0: el componente decide el
  // estado vacío sumando los totales, no contando cuántas filas llegaron.
  return TIPOS.map((tipo) => ({ tipo, total: countByTipo.get(tipo) ?? 0 }));
}

export interface MaintenanceTypeLogEntry {
  id: string;
  vehicleRecordId: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  fecha: Date;
  tipoServicio: string;
  estatus: string;
}

// Desglose de una rebanada del pastel: los mantenimientos concretos de ese
// tipo, con link directo a la bitácora de esa unidad (mismo patrón que
// getMaintenanceLogsForPiece en lib/piece-maintenance-stats.ts).
export async function getMaintenanceLogsForType(
  cityId: string | null,
  tipoMantenimiento: string,
  range: MonthRange = getCurrentMonthRange(),
  vehicleRecordId?: string
): Promise<MaintenanceTypeLogEntry[]> {
  const logs = await prisma.maintenanceLog.findMany({
    where: {
      vehicleRecord: vehicleRecordId ? { id: vehicleRecordId } : cityId ? { section: { cityId } } : {},
      tipoMantenimiento,
      fecha: { gte: range.start, lt: range.end },
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

  return logs.map((log) => ({
    id: log.id,
    vehicleRecordId: log.vehicleRecordId,
    numeroEconomico: log.vehicleRecord.numeroEconomico,
    citySlug: log.vehicleRecord.section.city.slug,
    cityName: log.vehicleRecord.section.city.name,
    fecha: log.fecha,
    tipoServicio: log.tipoServicio,
    estatus: log.estatus,
  }));
}
