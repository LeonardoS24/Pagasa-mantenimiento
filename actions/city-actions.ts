"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
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

  await prisma.city.create({
    data: { name, slug, order: (maxOrder._max.order ?? 0) + 1 },
  });

  revalidatePath("/admin/ciudades");
  revalidatePath("/dashboard");
  return { success: "Ciudad creada correctamente." };
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

export async function deleteCity(cityId: string) {
  await requireAdmin();
  await prisma.city.delete({ where: { id: cityId } });
  revalidatePath("/admin/ciudades");
  revalidatePath("/dashboard");
  redirect("/admin/ciudades");
}
