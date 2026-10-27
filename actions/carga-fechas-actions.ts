"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { idsDeTrabajo } from "@/lib/ciudades-de-trabajo";
import { aplicarCambios, previsualizar, type Previsualizacion, type ResultadoAplicar } from "@/lib/carga-fechas-servidor";
import type { CambioFecha } from "@/lib/carga-fechas";

// Carga masiva de fechas de la ficha técnica desde Excel. Mismo permiso que
// editar la ficha (requireElevatedEditor) y acceso a la ciudad.

const TAMANO_MAX = 10 * 1024 * 1024;

async function ciudadConAcceso(citySlug: string) {
  const user = await requireElevatedEditor();
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) throw new Error("La ciudad no existe.");
  await assertCityAccessById(user, city.id);
  return { user, city, ids: await idsDeTrabajo(user, city) };
}

export async function previsualizarFechas(citySlug: string, formData: FormData): Promise<Previsualizacion & { error?: string }> {
  const { ids } = await ciudadConAcceso(citySlug);
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { cambios: [], problemas: [], filasLeidas: 0, error: "Elige el archivo de Excel." };
  if (archivo.size > TAMANO_MAX) return { cambios: [], problemas: [], filasLeidas: 0, error: "El archivo pesa más de 10 MB." };
  if (!/\.xlsx?$/i.test(archivo.name)) return { cambios: [], problemas: [], filasLeidas: 0, error: "Tiene que ser un archivo de Excel (.xlsx)." };
  return previsualizar(Buffer.from(await archivo.arrayBuffer()), ids);
}

export async function aplicarFechas(citySlug: string, cambios: CambioFecha[]): Promise<ResultadoAplicar & { error?: string }> {
  const { user, city, ids } = await ciudadConAcceso(citySlug);
  if (!Array.isArray(cambios) || cambios.length === 0) return { aplicados: 0, unidades: 0, omitidos: [], error: "No hay cambios que aplicar." };
  if (cambios.length > 20_000) return { aplicados: 0, unidades: 0, omitidos: [], error: "Demasiados cambios en una sola carga." };
  const resultado = await aplicarCambios(cambios, ids, user);
  revalidatePath(`/ciudades/${city.slug}`, "layout");
  return resultado;
}
