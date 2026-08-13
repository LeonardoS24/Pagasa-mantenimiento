import { prisma } from "./prisma";

// "Administración": una ciudad especial (fila real en City, ver
// scripts/create-aggregate-city.ts) que se puede asignar a un usuario igual
// que cualquier otra ciudad real (ver UserCityAccess), pero cuya Bitácora de
// unidades combina el feed y los gráficos de todas las ciudades reales en
// vez de mostrar solo las suyas — no tiene unidades ni equipos propios.
export const AGGREGATE_CITY_SLUG = "administracion";

export function isAggregateCitySlug(slug: string): boolean {
  return slug === AGGREGATE_CITY_SLUG;
}

// IDs de todas las ciudades reales (sin "Administración"), usado por las
// páginas de /admin que muestran el panorama completo sin importar a qué
// ciudades tenga acceso asignado el admin que esté viendo la página (ver
// app/(protected)/admin/alertas/page.tsx y components/admin/ResumenPanel.tsx).
export async function getAllRealCityIds(): Promise<string[]> {
  const cities = await prisma.city.findMany({
    where: { slug: { not: AGGREGATE_CITY_SLUG } },
    select: { id: true },
  });
  return cities.map((c) => c.id);
}
