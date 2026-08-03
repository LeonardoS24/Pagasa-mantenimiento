"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { getSession } from "@/lib/auth";
import { roleSchema } from "@/lib/roles";

const loginSchema = z.object({
  username: z.string().min(1, "Ingresa tu usuario"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Usuario y contraseña son requeridos." };
  }

  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  const role = roleSchema.parse(user.role);

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.role = role;
  await session.save();

  redirect("/dashboard");
}
