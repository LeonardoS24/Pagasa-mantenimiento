import { prisma } from "@/lib/prisma";
import { getCurrentMonthRange } from "@/lib/dates";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";
import type { RecordCountCityStat } from "@/lib/record-count-stats";
import type { MonthRange } from "@/lib/piece-maintenance-stats";

// Cuántas órdenes de pieza se levantaron en el mes, por ciudad — mismo
// patrón que getExtinguisherChangeStatsByCity, para la gráfica de
// Administración sobre las órdenes que se realizan (ver el apartado "Orden").
export async function getPieceOrderStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<RecordCountCityStat[]> {
  const cities = await prisma.city.findMany({
    where: { slug: { not: AGGREGATE_CITY_SLUG } },
    orderBy: { order: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const orders = await prisma.pieceOrder.findMany({
    where: { fechaOrden: { gte: range.start, lt: range.end } },
    select: { section: { select: { cityId: true } } },
  });

  const countByCityId = new Map<string, number>();
  for (const order of orders) {
    const cityId = order.section.cityId;
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
