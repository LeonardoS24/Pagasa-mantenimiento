import { prisma } from "@/lib/prisma";
import { getCurrentMonthRange } from "@/lib/dates";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";
import { pieceOrderStatusSchema, type PieceOrderStatus } from "@/lib/inventory-enums";
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

export interface PieceOrderStatusCityStat {
  cityId: string;
  cityName: string;
  citySlug: string;
  porEstado: Record<PieceOrderStatus, number>;
  total: number;
}

// Desglose por estado (Pendiente/Aceptada/Rechazada/En inventario) de las
// órdenes de cada ciudad en el mes, para la gráfica de barra apilada de
// Administración (ver components/city/PieceOrderStatusChart.tsx). Mismo
// alcance que getPieceOrderStatsByCity (que solo suma el total), pero
// separado por estado.
export async function getPieceOrderStatusStatsByCity(
  range: MonthRange = getCurrentMonthRange()
): Promise<PieceOrderStatusCityStat[]> {
  const cities = await prisma.city.findMany({
    where: { slug: { not: AGGREGATE_CITY_SLUG } },
    orderBy: { order: "asc" },
    select: { id: true, name: true, slug: true },
  });

  const orders = await prisma.pieceOrder.findMany({
    where: { fechaOrden: { gte: range.start, lt: range.end } },
    select: { estado: true, section: { select: { cityId: true } } },
  });

  const countByCityId = new Map<string, Record<PieceOrderStatus, number>>();
  function vacio(): Record<PieceOrderStatus, number> {
    return Object.fromEntries(pieceOrderStatusSchema.options.map((estado) => [estado, 0])) as Record<
      PieceOrderStatus,
      number
    >;
  }
  for (const order of orders) {
    const cityId = order.section.cityId;
    const porEstado = countByCityId.get(cityId) ?? vacio();
    const estado = (pieceOrderStatusSchema.options as string[]).includes(order.estado)
      ? (order.estado as PieceOrderStatus)
      : "PENDIENTE";
    porEstado[estado] += 1;
    countByCityId.set(cityId, porEstado);
  }

  return cities
    .map((city) => {
      const porEstado = countByCityId.get(city.id) ?? vacio();
      const total = Object.values(porEstado).reduce((sum, n) => sum + n, 0);
      return { cityId: city.id, cityName: city.name, citySlug: city.slug, porEstado, total };
    })
    .sort((a, b) => b.total - a.total);
}

export interface PieceOrderEntry {
  id: string;
  fechaOrden: Date;
  tipo: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  estado: string;
  citySlug: string;
}

// Desglose al hacer clic en una barra de PieceOrderStatsChart: las órdenes
// concretas de esa ciudad ese mes, con link al apartado "Orden de pieza" de
// esa ciudad (las órdenes no tienen su propia página, a diferencia de un
// mantenimiento).
export async function getPieceOrdersForCity(cityId: string, range: MonthRange): Promise<PieceOrderEntry[]> {
  const orders = await prisma.pieceOrder.findMany({
    where: { section: { cityId }, fechaOrden: { gte: range.start, lt: range.end } },
    orderBy: { fechaOrden: "desc" },
    include: { section: { select: { city: { select: { slug: true } } } } },
  });

  return orders.map((order) => ({
    id: order.id,
    fechaOrden: order.fechaOrden,
    tipo: order.tipo,
    nombre: order.nombre,
    cantidad: order.cantidad,
    unidad: order.unidad,
    estado: order.estado,
    citySlug: order.section.city.slug,
  }));
}
