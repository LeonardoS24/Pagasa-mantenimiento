"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { idsDeTrabajo } from "@/lib/ciudades-de-trabajo";
import { aplicarCambios, previsualizar, type Previsualizacion, type ResultadoAplicar } from "@/lib/carga-fechas-servidor";
import type { CambioCarga } from "@/lib/carga-fechas";

// Carga masiva de datos de la ficha (fechas, texto y ciudad) desde Excel.
// Mismo permiso que editar la ficha (requireElevatedEditor) y acceso a la
// ciudad. Cambiar de ciudad, además, solo un ADMIN (como el botón de la ficha).

const TAMANO_MAX = 10 * 1024 * 1024;
const SIN_RESULTADO: ResultadoAplicar = { aplicados: 0, unidades: 0, traspasos: 0, omitidos: [], ciudadesTocadas: [] };

async function ciudadConAcceso(citySlug: string) {
  const user = await requireElevatedEditor();
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) throw new Error("La ciudad no existe.");
  await assertCityAccessById(user, city.id);
  return { user, city, ids: await idsDeTrabajo(user, city), esAdmin: user.role === "ADMIN" };
}

export async function previsualizarFechas(citySlug: string, formData: FormData): Promise<Previsualizacion & { error?: string }> {
  const { ids, esAdmin } = await ciudadConAcceso(citySlug);
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { cambios: [], problemas: [], filasLeidas: 0, error: "Elige el archivo de Excel." };
  if (archivo.size > TAMANO_MAX) return { cambios: [], problemas: [], filasLeidas: 0, error: "El archivo pesa más de 10 MB." };
  if (!/\.xlsx?$/i.test(archivo.name)) return { cambios: [], problemas: [], filasLeidas: 0, error: "Tiene que ser un archivo de Excel (.xlsx)." };
  return previsualizar(Buffer.from(await archivo.arrayBuffer()), ids, esAdmin);
}

export async function aplicarFechas(
  citySlug: string,
  cambios: CambioCarga[],
  password: string
): Promise<ResultadoAplicar & { error?: string }> {
  const { user, city, ids, esAdmin } = await ciudadConAcceso(citySlug);
  // Después de ver el antes → después, quien aplica confirma con su contraseña
  // (como al borrar): el cambio queda a su nombre en la bitácora de actividad.
  const errorContrasena = await verifySessionPassword(user, password);
  if (errorContrasena) return { ...SIN_RESULTADO, error: errorContrasena };
  if (!Array.isArray(cambios) || cambios.length === 0) return { ...SIN_RESULTADO, error: "No hay cambios que aplicar." };
  if (cambios.length > 20_000) return { ...SIN_RESULTADO, error: "Demasiados cambios en una sola carga." };
  const resultado = await aplicarCambios(cambios, ids, user, esAdmin);
  revalidatePath(`/ciudades/${city.slug}`, "layout");
  for (const slug of resultado.ciudadesTocadas) revalidatePath(`/ciudades/${slug}`, "layout");
  if (resultado.traspasos > 0) {
    revalidatePath("/ciudades/administracion", "layout");
    revalidatePath("/dashboard");
    revalidatePath("/admin/alertas");
  }
  return resultado;
}
