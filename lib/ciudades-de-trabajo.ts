import { getAccessibleCities } from "./access";
import { isAggregateCitySlug } from "./aggregate-city";
import type { UsuarioSesion } from "./session";

// Con qué ciudades trabaja una pantalla: la ciudad de la URL o, en
// "Administración" (ciudad agregada), todas las reales a las que la persona
// tiene acceso.
export async function idsDeTrabajo(user: UsuarioSesion, city: { id: string; slug: string }): Promise<string[]> {
  if (!isAggregateCitySlug(city.slug)) return [city.id];
  return (await getAccessibleCities(user)).filter((c) => !isAggregateCitySlug(c.slug)).map((c) => c.id);
}
