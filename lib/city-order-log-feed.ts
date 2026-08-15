import { prisma } from "@/lib/prisma";
import { pieceOrderStatusLabels, type PieceOrderStatus } from "@/lib/inventory-enums";
import type { MonthRange } from "@/lib/piece-maintenance-stats";

export interface OrderLogEvent {
  id: string;
  fecha: Date;
  nombre: string;
  tipo: string;
  cantidad: number;
  unidad: string;
  estado: PieceOrderStatus;
  vehicleRecordId: string | null;
  numeroEconomico: string | null;
  citySlug: string;
  cityName: string;
}

const TAKE = 100;
const TAKE_RANGE = 2000;

// Mismo patrón que getCityUnitLogFeed (lib/city-unit-log-feed.ts) pero para
// PieceOrder: un feed cronológico de todas las órdenes levantadas, mes por
// mes en Administración (con el mismo selector de mes que ya usa Orden de
// pieza, ver showOrderMonthPicker en el catch-all de ciudad/apartado) o
// "actividad reciente" sin acotar en una ciudad real.
export async function getCityOrderLogFeed(cityId: string | null, range?: MonthRange): Promise<OrderLogEvent[]> {
  const take = range ? TAKE_RANGE : TAKE;
  const orders = await prisma.pieceOrder.findMany({
    where: {
      section: cityId ? { cityId } : {},
      fechaOrden: range ? { gte: range.start, lt: range.end } : undefined,
    },
    orderBy: { fechaOrden: "desc" },
    take,
    include: {
      section: { select: { city: { select: { slug: true, name: true } } } },
      vehicleRecord: { select: { id: true, numeroEconomico: true } },
    },
  });

  return orders.map((order) => ({
    id: order.id,
    fecha: order.fechaOrden,
    nombre: order.nombre,
    tipo: order.tipo,
    cantidad: order.cantidad,
    unidad: order.unidad,
    estado: (order.estado in pieceOrderStatusLabels ? order.estado : "PENDIENTE") as PieceOrderStatus,
    vehicleRecordId: order.vehicleRecord?.id ?? null,
    numeroEconomico: order.vehicleRecord?.numeroEconomico ?? null,
    citySlug: order.section.city.slug,
    cityName: order.section.city.name,
  }));
}
