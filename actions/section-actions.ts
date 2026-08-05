"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import { verifySessionPassword } from "@/lib/reauth";
import { getSectionDeleteImpact, getSectionSubtreeIds, impactTotal } from "@/lib/delete-impact";
import { deleteSectionDocumentFiles } from "@/lib/document-cleanup";
import type { ActionState } from "./user-actions";

const createSectionSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  cityId: z.string().min(1),
  parentId: z.string().min(1).nullable(),
});

export async function createSection(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const rawParentId = formData.get("parentId");
  const parsed = createSectionSchema.safeParse({
    name: formData.get("name"),
    cityId: formData.get("cityId"),
    parentId: rawParentId ? String(rawParentId) : null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const { name, cityId, parentId } = parsed.data;
  const slug = slugify(name.trim());

  const existing = await prisma.section.findFirst({ where: { cityId, parentId, slug } });
  if (existing) {
    return { error: "Ya existe un apartado con ese nombre en este nivel." };
  }

  const maxOrder = await prisma.section.aggregate({
    where: { cityId, parentId },
    _max: { order: true },
  });

  await prisma.section.create({
    data: {
      cityId,
      parentId,
      name: name.trim(),
      slug,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  revalidatePath(`/admin/ciudades/${cityId}`);
  return { success: "Apartado creado correctamente." };
}

export async function updateSection(
  sectionId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) {
    return { error: "El apartado no existe." };
  }

  const nameValue = formData.get("name");
  const nameSchema = z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100);
  const parsed = nameSchema.safeParse(nameValue);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const name = parsed.data.trim();
  const slug = slugify(name);

  const existing = await prisma.section.findFirst({
    where: { id: { not: sectionId }, cityId: section.cityId, parentId: section.parentId, slug },
  });
  if (existing) {
    return { error: "Ya existe un apartado con ese nombre en este nivel." };
  }

  await prisma.section.update({ where: { id: sectionId }, data: { name, slug } });

  revalidatePath(`/admin/ciudades/${section.cityId}`);
  return { success: "Apartado actualizado." };
}

// Solo para pintar la confirmación: no borra nada.
export async function previewSectionDeleteImpact(sectionId: string) {
  await requireAdmin();
  const impacto = await getSectionDeleteImpact(sectionId);
  return { impacto, pideContrasena: impactTotal(impacto) > 0 };
}

// Un apartado con contenido arrastra unidades, bitácoras y documentos, así que
// pide la contraseña de quien está en sesión. Uno vacío (recién creado, o mal
// escrito) se borra con la confirmación de siempre: exigir contraseña ahí solo
// estorbaría al ordenar la estructura.
export async function deleteSection(
  sectionId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) {
    return { error: "El apartado ya no existe." };
  }

  const impacto = await getSectionDeleteImpact(sectionId);
  if (impactTotal(impacto) > 0) {
    const passwordError = await verifySessionPassword(admin, formData.get("password"));
    if (passwordError) {
      return { error: passwordError };
    }
  }

  await deleteSectionDocumentFiles(await getSectionSubtreeIds(sectionId));
  await prisma.section.delete({ where: { id: sectionId } });

  revalidatePath(`/admin/ciudades/${section.cityId}`);
  return { success: `Apartado “${section.name}” eliminado.` };
}
