"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { registrarAcceso } from "@/lib/registro-acceso";

// Cierra una sesión abierta de cualquier persona (por ejemplo, una que quedó
// abierta en un equipo compartido). Borrar la fila basta: getSession la deja
// de reconocer en la siguiente petición.
export async function cerrarSesionAjena(sesionId: string): Promise<void> {
  const admin = await requireAdmin();
  const sesion = await prisma.sesionActiva.findUnique({ where: { id: sesionId }, include: { user: { select: { username: true } } } });
  if (!sesion) return;
  await prisma.sesionActiva.delete({ where: { id: sesionId } });
  await registrarAcceso({
    evento: "SESION_CERRADA_POR_ADMIN",
    username: sesion.user.username,
    userId: sesion.userId,
    actorUsername: admin.username,
    detalle: [sesion.ip, sesion.navegador].filter(Boolean).join(" · ") || null,
  });
  revalidatePath("/admin/accesos");
}

// Quita el bloqueo por intentos fallidos sin tener que esperar los 15 min.
export async function desbloquearCuenta(userId: string): Promise<void> {
  const admin = await requireAdmin();
  const user = await prisma.user.update({ where: { id: userId }, data: { bloqueadoHasta: null, intentosFallidosLogin: 0 } });
  await registrarAcceso({ evento: "CUENTA_DESBLOQUEADA", username: user.username, userId, actorUsername: admin.username });
  revalidatePath("/admin/accesos");
}
