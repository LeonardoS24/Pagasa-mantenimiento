import { prisma } from "@/lib/prisma";
import { equipoColorKey, type BadgeColorKey } from "@/lib/section-colors";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";

export interface EquipmentLogEvent {
  id: string;
  fecha: Date;
  tipo: string;
  colorKey: BadgeColorKey;
  equipoId: string;
  nombreEquipo: string;
  citySlug: string;
  cityName: string;
  detalle: string;
}

// Bitácora única de equipos, ordenada por fecha y coloreada según el tipo
// del equipo al que pertenece cada registro (mecánico, eléctrico/electrónico
// o auxiliar — ver lib/equipo-enums.ts). cityId null = todas las ciudades
// combinadas (ver el apartado "Administración", lib/aggregate-city.ts),
// mismo patrón que getCityUnitLogFeed.
export async function getCityEquipmentLogFeed(cityId: string | null): Promise<EquipmentLogEvent[]> {
  const logs = await prisma.equipmentLog.findMany({
    where: {
      equipo: { section: cityId ? { cityId } : { city: { slug: { not: AGGREGATE_CITY_SLUG } } } },
    },
    orderBy: { fecha: "desc" },
    take: 150,
    include: {
      equipo: {
        select: { id: true, nombre: true, tipoEquipo: true, section: { select: { city: true } } },
      },
    },
  });

  return logs.map((log) => ({
    id: log.id,
    fecha: log.fecha,
    tipo: `${log.tipoMantenimiento} — Equipo`,
    colorKey: equipoColorKey(log.equipo.tipoEquipo),
    equipoId: log.equipoId,
    nombreEquipo: log.equipo.nombre,
    citySlug: log.equipo.section.city.slug,
    cityName: log.equipo.section.city.name,
    detalle: log.descripcion,
  }));
}
