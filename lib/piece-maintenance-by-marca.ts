import { prisma } from "@/lib/prisma";
import { accionPiezaOptions, type AccionPieza } from "@/lib/piece-catalog";
import { getCurrentMonthRange } from "@/lib/dates";
import type { MonthRange, PieceMaintenanceStat } from "@/lib/piece-maintenance-stats";

export interface MarcaMaintenanceGroup {
  marca: string;
  stats: PieceMaintenanceStat[];
}

const SIN_MARCA = "Sin marca registrada";

// Mismo desglose que getPieceMaintenanceStats (lib/piece-maintenance-stats.ts)
// pero agrupado primero por VehicleTechnicalSheet.marca (el catálogo de
// Marca/Línea/Modelo, ver lib/vehicle-brand-catalog.ts): para cada marca,
// cuáles son las piezas que más mantenimiento reciben. Así se puede comparar
// entre tipos de unidad (p.ej. si a los Kenworth les fallan más las
// válvulas que a los Ford). cityId null = todas las ciudades combinadas
// (ver Administración, lib/aggregate-city.ts).
export async function getPieceMaintenanceStatsByMarca(
  cityId: string | null,
  range: MonthRange = getCurrentMonthRange(),
  limitPerMarca = 5
): Promise<MarcaMaintenanceGroup[]> {
  const { start, end } = range;
  const logs = await prisma.maintenanceLog.findMany({
    where: {
      vehicleRecord: cityId ? { section: { cityId } } : {},
      pieza: { not: null },
      accionPieza: { not: null },
      fecha: { gte: start, lt: end },
    },
    select: {
      categoriaPieza: true,
      pieza: true,
      accionPieza: true,
      vehicleRecord: { select: { technicalSheet: { select: { marca: true } } } },
    },
  });

  const byMarca = new Map<string, Map<string, PieceMaintenanceStat>>();
  for (const log of logs) {
    const accion = log.accionPieza as AccionPieza;
    if (!accionPiezaOptions.includes(accion)) continue;
    const pieza = log.pieza!;
    const categoria = log.categoriaPieza;
    const marca = log.vehicleRecord.technicalSheet?.marca?.trim() || SIN_MARCA;

    let byKey = byMarca.get(marca);
    if (!byKey) {
      byKey = new Map();
      byMarca.set(marca, byKey);
    }
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

  return Array.from(byMarca.entries())
    .map(([marca, stats]) => ({
      marca,
      stats: Array.from(stats.values())
        .sort((a, b) => b.total - a.total)
        .slice(0, limitPerMarca),
    }))
    .sort((a, b) => {
      const totalA = a.stats.reduce((sum, s) => sum + s.total, 0);
      const totalB = b.stats.reduce((sum, s) => sum + s.total, 0);
      return totalB - totalA;
    });
}
