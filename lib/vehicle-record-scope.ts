import type { Prisma } from "@prisma/client";

// Arma el filtro `vehicleRecord: {...}` compartido por las consultas de
// bitácora/gráficas (piece-maintenance-stats, maintenance-type-stats,
// city-unit-log-feed): cityId null = todas las ciudades combinadas
// (Administración); sectionSlugs opcional acota a un subconjunto de
// apartados (p.ej. solo Estaciones/Planta, ver Bitácora de estaciones y
// lib/estacion-sections.ts) sin importar la ciudad.
export function vehicleRecordScopeWhere(
  cityId: string | null,
  sectionSlugs?: string[]
): Prisma.VehicleRecordWhereInput {
  if (!cityId && !sectionSlugs) return {};
  return {
    section: {
      ...(cityId ? { cityId } : {}),
      ...(sectionSlugs ? { slug: { in: sectionSlugs } } : {}),
    },
  };
}
