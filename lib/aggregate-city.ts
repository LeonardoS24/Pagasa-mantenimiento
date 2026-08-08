// "Administración": una ciudad especial (fila real en City, ver
// scripts/create-aggregate-city.ts) que se puede asignar a un usuario igual
// que cualquier otra ciudad real (ver UserCityAccess), pero cuya Bitácora de
// unidades combina el feed y los gráficos de todas las ciudades reales en
// vez de mostrar solo las suyas — no tiene unidades ni equipos propios.
export const AGGREGATE_CITY_SLUG = "administracion";

export function isAggregateCitySlug(slug: string): boolean {
  return slug === AGGREGATE_CITY_SLUG;
}
