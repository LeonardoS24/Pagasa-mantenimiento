"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireAdmin, requireUser, getSession } from "@/lib/auth";
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

// Cambiar el rol de una cuenta existente. Antes solo se definía al crearla, y
// para corregirlo había que borrar el usuario y volver a crearlo: se perdía la
// asignación de ciudades y había que rehacerla a mano. requireUser relee el rol
// de la base en cada request, así que el cambio surte efecto de inmediato, sin
// que la persona tenga que volver a entrar.
export async function changeUserRole(
  userId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();

  const parsed = roleSchema.safeParse(formData.get("role"));
  if (!parsed.success) {
    return { error: "Rol inválido." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return { error: "El usuario ya no existe." };
  }
  if (user.role === parsed.data) {
    return { success: `${user.username} ya tenía ese rol.` };
  }

  // Quitarse a uno mismo el rol de administrador equivale a cerrarse la puerta
  // del panel desde dentro, sin forma de volver a entrar.
  if (admin.userId === userId && parsed.data !== "ADMIN") {
    return { error: "No puedes quitarte a ti mismo el rol de administrador." };
  }

  // Y el sistema no puede quedarse sin ningún administrador: nadie podría
  // crear usuarios, ciudades ni recuperar el acceso.
  if (user.role === "ADMIN" && parsed.data !== "ADMIN") {
    const otrosAdmins = await prisma.user.count({
      where: { role: "ADMIN", id: { not: userId } },
    });
    if (otrosAdmins === 0) {
      return { error: "Es el único administrador. Nombra otro antes de cambiarle el rol." };
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { role: parsed.data } });

  // Un ADMIN ve todas las ciudades sin necesidad de asignaciones; al dejar de
  // serlo se queda sin ninguna, así que conviene avisarlo.
  const sinCiudades =
    parsed.data !== "ADMIN" &&
    (await prisma.userCityAccess.count({ where: { userId } })) === 0;

  revalidatePath("/admin/usuarios");
  revalidatePath(`/admin/usuarios/${userId}`);
  return {
    success: sinCiudades
      ? `Rol actualizado. Asígnale las ciudades a las que tendrá acceso.`
      : "Rol actualizado.",
  };
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

// Cualquier usuario (no solo ADMIN) puede apagar para sí mismo el aviso de
// mantenimientos "En proceso" que se muestra al iniciar sesión (ver
// actions/auth-actions.ts y components/layout/InProgressAlertToast.tsx).
export async function disableInProgressAlerts() {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.userId },
    data: { avisosMantenimientoActivos: false },
  });
}

const elevatedAccessSchema = z.object({
  dias: z.array(z.number().int().min(0).max(6)).min(1, "Selecciona al menos un día"),
  horaInicio: z.string().regex(/^\d{2}:\d{2}$/, "Hora de inicio inválida"),
  horaFin: z.string().regex(/^\d{2}:\d{2}$/, "Hora de fin inválida"),
});

// Solo ADMIN configura esto, y solo aplica a rol USUARIO: dentro del
// horario, ese usuario puede editar/borrar registros y ficha técnica como si
// fuera ADMIN (ver lib/auth.ts: requireElevatedEditor), pero nunca borrar
// ciudades/apartados/usuarios ni cambiar roles — eso sigue exigiendo
// requireAdmin a secas en esas acciones, sin importar la hora.
export async function updateElevatedAccessSchedule(
  userId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "El usuario no existe." };
  if (user.role !== "USUARIO") {
    return { error: "El acceso ampliado solo aplica a cuentas con rol Usuario." };
  }

  const dias = formData.getAll("dias").map(Number);
  const horaInicio = String(formData.get("horaInicio") ?? "");
  const horaFin = String(formData.get("horaFin") ?? "");

  const parsed = elevatedAccessSchema.safeParse({ dias, horaInicio, horaFin });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      accesoAmpliadoDias: JSON.stringify(parsed.data.dias),
      accesoAmpliadoHoraInicio: parsed.data.horaInicio,
      accesoAmpliadoHoraFin: parsed.data.horaFin,
    },
  });

  revalidatePath(`/admin/usuarios/${userId}`);
  return { success: "Acceso ampliado guardado." };
}

export async function disableElevatedAccessSchedule(userId: string): Promise<void> {
  await requireAdmin();
  await prisma.user.update({
    where: { id: userId },
    data: { accesoAmpliadoDias: null, accesoAmpliadoHoraInicio: null, accesoAmpliadoHoraFin: null },
  });
  revalidatePath(`/admin/usuarios/${userId}`);
}

// Lee y borra en el mismo paso el aviso pendiente que loginAction dejó en la
// sesión (ver actions/auth-actions.ts). Solo un Server Action puede escribir
// cookies, por eso InProgressAlertToast lo llama al montarse en vez de que el
// layout protegido (Server Component) lea/borre la sesión directamente.
export async function consumePendingInProgressAlert(): Promise<number | null> {
  const session = await getSession();
  const count = session.pendingInProgressCount;
  if (count === undefined) return null;

  session.pendingInProgressCount = undefined;
  await session.save();
  return count;
}
