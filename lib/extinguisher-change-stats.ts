import { prisma } from "@/lib/prisma";
import { getCurrentMonthRange } from "@/lib/dates";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";
import type { MonthRange } from "@/lib/piece-maintenance-stats";

export interface ExtinguisherChangeCityStat {
  cityId: string;
  cityName: string;
  citySlug: string;
  total: number;
}

// Cuántos cambios de extintor se registraron en el mes, por ciudad. A
// diferencia del gráfico de piezas (que vive dentro de cada ciudad), este
// solo tiene sentido comparando entre ciudades, así que vive en el apartado
// "Administración" (ver lib/aggregate-city.ts). range es opcional (default:
// mes en curso); el selector de mes de Administración puede pedir cualquier
// otro mes ya pasado. Los registros en sí no se borran, solo se acota lo
// que entra al gráfico.
export async function getExtinguisherChangeStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<ExtinguisherChangeCityStat[]> {
  const { start, end } = range;

  const cities = await prisma.city.findMany({
    where: { slug: { not: AGGREGATE_CITY_SLUG } },
    orderBy: { order: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const logs = await prisma.extinguisherChangeLog.findMany({
    where: { fechaRealizacion: { gte: start, lt: end } },
    select: { vehicleRecord: { select: { section: { select: { cityId: true } } } } },
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
