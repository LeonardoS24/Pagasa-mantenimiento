"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { CIUDADES_ALMACEN } from "@/lib/almacen";
import { aplicarPendiente, descartarPendiente, idDeHoja, revisarHoja } from "@/lib/almacen-servidor";

// Inventario de almacén (hoja de Google). Mismo permiso que editar la ficha
// (requireElevatedEditor) + acceso a la ciudad. Por ahora solo Hermosillo.

async function ciudadDelAlmacen(citySlug: string) {
  const user = await requireElevatedEditor();
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) throw new Error("La ciudad no existe.");
  if (!CIUDADES_ALMACEN.includes(city.slug)) throw new Error("El inventario de almacén por ahora solo funciona en Hermosillo.");
  await assertCityAccessById(user, city.id);
  return { user, city };
}

export type RespuestaAlmacen = { ok: boolean; error?: string; mensaje?: string };

export async function guardarEnlaceHoja(citySlug: string, url: string): Promise<RespuestaAlmacen> {
  const { user, city } = await ciudadDelAlmacen(citySlug);
  const limpia = String(url ?? "").trim();
  if (limpia !== "" && !idDeHoja(limpia)) {
    return { ok: false, error: "Pega el enlace de la hoja de Google (empieza con https://docs.google.com/spreadsheets/d/…)." };
  }
  await prisma.almacenConfig.upsert({
    where: { cityId: city.id },
    update: { urlHoja: limpia || null, ultimoError: null, pendiente: null, pendienteHuella: null, pendienteEl: null },
    create: { cityId: city.id, urlHoja: limpia || null },
  });
  await logActivity({ user, accion: "EDITAR", entidad: "Enlace de la hoja de inventario de almacén", resumen: city.name, citySlug: city.slug });
  revalidatePath(`/ciudades/${city.slug}/almacen`);
  return { ok: true, mensaje: limpia ? "Enlace guardado." : "Enlace quitado." };
}

export async function leerHojaAhora(citySlug: string): Promise<RespuestaAlmacen> {
  const { city } = await ciudadDelAlmacen(citySlug);
  const r = await revisarHoja(city.id);
  revalidatePath(`/ciudades/${city.slug}/almacen`);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, mensaje: r.hayCambios ? "Se leyó la hoja: hay cambios por revisar." : "Se leyó la hoja: el sistema ya está igual." };
}

export async function aprobarCambiosAlmacen(citySlug: string, password: string): Promise<RespuestaAlmacen> {
  const { user, city } = await ciudadDelAlmacen(citySlug);
  // Después de ver qué cambia, quien aprueba lo confirma con su contraseña.
  const errorContrasena = await verifySessionPassword(user, password);
  if (errorContrasena) return { ok: false, error: errorContrasena };
  const r = await aplicarPendiente(city.id, city.slug, user);
  revalidatePath(`/ciudades/${city.slug}/almacen`);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, mensaje: `Listo: se guardaron ${r.articulos} cambio(s) de artículos y ${r.movimientos} de movimientos. Quedó en la bitácora de actividad a tu nombre.` };
}

export async function descartarCambiosAlmacen(citySlug: string): Promise<RespuestaAlmacen> {
  const { user, city } = await ciudadDelAlmacen(citySlug);
  await descartarPendiente(city.id);
  await logActivity({ user, accion: "EDITAR", entidad: "Cambios del inventario de almacén descartados", resumen: city.name, citySlug: city.slug });
  revalidatePath(`/ciudades/${city.slug}/almacen`);
  return { ok: true, mensaje: "Se descartaron. No volverán a salir hasta que la hoja cambie." };
}
