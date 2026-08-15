import { prisma } from "@/lib/prisma";
import { inventoryItemStatusLabels, type InventoryItemStatus } from "@/lib/inventory-enums";

export interface InventoryFeedItem {
  id: string;
  nombre: string;
  tipo: string;
  cantidad: number;
  unidad: string;
  fechaIngreso: Date;
  fechaUtilizada: Date | null;
  estado: InventoryItemStatus;
  citySlug: string;
  cityName: string;
  usedOnVehicle: { id: string; numeroEconomico: string } | null;
}

// Mismo patrón que getCityOrderLogFeed (lib/city-order-log-feed.ts): todo el
// inventario, de todas las ciudades reales, para el apartado "Inventarios" de
// Administración (ver isInventarios && isAggregateCity en el catch-all de
// ciudad/apartado). Es de solo lectura — editar un renglón (estado, borrar)
// se sigue haciendo desde el Inventarios de su propia ciudad, donde además se
// puede elegir la unidad de destino de esa misma ciudad.
export async function getCityInventoryFeed(cityIds: string[]): Promise<InventoryFeedItem[]> {
  if (cityIds.length === 0) return [];

  const items = await prisma.inventoryItem.findMany({
    where: { section: { cityId: { in: cityIds } } },
    orderBy: { fechaIngreso: "desc" },
    include: {
      section: { select: { city: { select: { slug: true, name: true } } } },
      usedOnVehicle: { select: { id: true, numeroEconomico: true } },
    },
  });

  return items.map((item) => ({
    id: item.id,
    nombre: item.nombre,
    tipo: item.tipo,
    cantidad: item.cantidad,
    unidad: item.unidad,
    fechaIngreso: item.fechaIngreso,
    fechaUtilizada: item.fechaUtilizada,
    estado: (item.estado in inventoryItemStatusLabels ? item.estado : "EN_INVENTARIO") as InventoryItemStatus,
    citySlug: item.section.city.slug,
    cityName: item.section.city.name,
    usedOnVehicle: item.usedOnVehicle,
  }));
}
