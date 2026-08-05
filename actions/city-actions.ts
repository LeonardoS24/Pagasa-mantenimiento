"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import { verifySessionPassword } from "@/lib/reauth";
import { getCityDeleteImpact } from "@/lib/delete-impact";
import { deleteSectionDocumentFiles } from "@/lib/document-cleanup";
import { crearApartadosEstandar } from "@/lib/city-template";
import type { ActionState } from "./user-actions";

const createCitySchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
});

export async function createCity(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const parsed = createCitySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const name = parsed.data.name.trim();
  const slug = slugify(name);

  const existing = await prisma.city.findFirst({ where: { OR: [{ name }, { slug }] } });
  if (existing) {
    return { error: "Ya existe una ciudad con ese nombre." };
  }

  const maxOrder = await prisma.city.aggregate({ _max: { order: true } });

  const city = await prisma.city.create({
    data: { name, slug, order: (maxOrder._max.order ?? 0) + 1 },
  });

  // La ciudad nace con la estructura completa. Crearla vacía obligaba a armar
  // a mano los 10 apartados y los 4 sub-apartados de Unidad de distribución,
  // y un nombre mal escrito dejaba el apartado sin sus funciones.
  const creados = await crearApartadosEstandar(city.id);

  revalidatePath("/admin/ciudades");
  revalidatePath("/dashboard");
  return { success: `Ciudad creada con sus ${creados} apartados.` };
}

export async function updateCity(
  cityId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const parsed = createCitySchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const name = parsed.data.name.trim();
  const slug = slugify(name);

  const existing = await prisma.city.findFirst({
    where: { id: { not: cityId }, OR: [{ name }, { slug }] },
  });
  if (existing) {
    return { error: "Ya existe otra ciudad con ese nombre." };
  }

  await prisma.city.update({ where: { id: cityId }, data: { name, slug } });

  revalidatePath("/admin/ciudades");
  revalidatePath(`/admin/ciudades/${cityId}`);
  revalidatePath("/dashboard");
  return { success: "Ciudad actualizada." };
}

// Solo para pintar la confirmación: no borra nada. Una ciudad siempre pide
// contraseña, incluso vacía: borrarla desarma la estructura de una sede
// completa y no es algo que se haga al vuelo.
export async function previewCityDeleteImpact(cityId: string) {
  await requireAdmin();
  return { impacto: await getCityDeleteImpact(cityId), pideContrasena: true };
}

// Borrar una ciudad se lleva sus apartados, unidades, fichas técnicas,
// bitácoras y documentos. Por eso pide la contraseña de quien está en sesión,
// siempre, aunque la ciudad esté vacía.
export async function deleteCity(
  cityId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const city = await prisma.city.findUnique({ where: { id: cityId } });
  if (!city) {
    return { error: "La ciudad ya no existe." };
  }

  const sections = await prisma.section.findMany({ where: { cityId }, select: { id: true } });
  await deleteSectionDocumentFiles(sections.map((s) => s.id));

  await prisma.city.delete({ where: { id: cityId } });

  revalidatePath("/admin/ciudades");
  revalidatePath("/dashboard");
  return { success: `Ciudad “${city.name}” eliminada.` };
}
