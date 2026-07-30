"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireAdmin } from "@/lib/auth";
import { roleSchema } from "@/lib/roles";

export interface ActionState {
  error?: string;
  success?: string;
}

const createUserSchema = z.object({
  username: z
    .string()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(50)
    .regex(/^[a-zA-Z0-9._-]+$/, "Solo letras, números, punto, guion y guion bajo"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: roleSchema,
});

export async function createUser(
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const parsed = createUserSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const existing = await prisma.user.findUnique({ where: { username: parsed.data.username } });
  if (existing) {
    return { error: "Ese nombre de usuario ya existe." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.create({
    data: {
      username: parsed.data.username,
      passwordHash,
      role: parsed.data.role,
    },
  });

  revalidatePath("/admin/usuarios");
  return { success: "Usuario creado correctamente." };
}

export async function deleteUser(userId: string) {
  const admin = await requireAdmin();
  if (admin.userId === userId) {
    throw new Error("No puedes eliminar tu propia cuenta.");
  }
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath("/admin/usuarios");
  redirect("/admin/usuarios");
}

const changePasswordSchema = z.object({
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export async function changeUserPassword(
  userId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const parsed = changePasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Contraseña inválida" };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return { success: "Contraseña actualizada." };
}

export async function assignUserCities(userId: string, cityIds: string[]) {
  await requireAdmin();

  await prisma.$transaction([
    prisma.userCityAccess.deleteMany({ where: { userId } }),
    prisma.userCityAccess.createMany({
      data: cityIds.map((cityId) => ({ userId, cityId })),
    }),
  ]);

  revalidatePath(`/admin/usuarios/${userId}`);
}

export async function assignUserCitiesAction(userId: string, formData: FormData) {
  const cityIds = formData.getAll("cityIds").map(String);
  await assignUserCities(userId, cityIds);
  redirect(`/admin/usuarios/${userId}`);
}
