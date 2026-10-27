"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession, requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { problemaDeContrasena } from "@/lib/politica-contrasena";
import { registrarAcceso } from "@/lib/registro-acceso";
import { rutaInternaSegura } from "@/lib/ruta-segura";
import { BLOQUEO_MINUTOS, MAX_INTENTOS_FALLIDOS, acierto, fallo, reservarIntentoDeCuenta } from "@/lib/freno-intentos";

export interface CambioContrasenaState {
  error?: string;
}

// Cualquier persona cambia su propia contraseña (y es lo único que puede
// hacer mientras tenga el cambio pendiente: ver middleware.ts).
export async function cambiarMiContrasena(
  _prev: CambioContrasenaState,
  formData: FormData
): Promise<CambioContrasenaState> {
  const usuario = await requireUser({ aunqueDebaCambiarContrasena: true });
  const actual = String(formData.get("actual") ?? "");
  const nueva = String(formData.get("nueva") ?? "");
  const confirmar = String(formData.get("confirmar") ?? "");

  const registro = await prisma.user.findUnique({ where: { id: usuario.userId }, select: { passwordHash: true } });
  if (!registro) return { error: "Tu cuenta ya no existe." };
  if (!actual) return { error: "Escribe tu contraseña actual." };
  // Mismo freno que el login: con una sesión ajena abierta (un equipo
  // desatendido) no se puede adivinar la contraseña actual sin límite.
  const reserva = await reservarIntentoDeCuenta(usuario.userId);
  if (!reserva.permitido) {
    return { error: "Tu cuenta está bloqueada por varios intentos fallidos. Espera unos minutos." };
  }
  if (!(await verifyPassword(actual, registro.passwordHash))) {
    await registrarAcceso({
      evento: "INTENTO_FALLIDO",
      username: usuario.username,
      userId: usuario.userId,
      detalle: "Contraseña actual incorrecta al querer cambiarla",
    });
    if (await fallo(usuario.userId, reserva.numero)) {
      // Se bloquea la cuenta y se cierran todas sus sesiones, esta incluida.
      await prisma.sesionActiva.deleteMany({ where: { userId: usuario.userId } });
      await registrarAcceso({
        evento: "CUENTA_BLOQUEADA",
        username: usuario.username,
        userId: usuario.userId,
        detalle: `${MAX_INTENTOS_FALLIDOS} intentos fallidos al cambiar la contraseña: bloqueada ${BLOQUEO_MINUTOS} minutos`,
      });
      return { error: "Demasiados intentos. La cuenta quedó bloqueada y se cerró la sesión." };
    }
    return { error: "La contraseña actual no es correcta." };
  }
  await acierto(usuario.userId);
  if (nueva !== confirmar) return { error: "La contraseña nueva y la confirmación no coinciden." };
  if (nueva === actual) return { error: "La contraseña nueva tiene que ser distinta de la actual." };
  const problema = problemaDeContrasena(nueva, usuario.username);
  if (problema) return { error: problema };

  await prisma.user.update({
    where: { id: usuario.userId },
    data: { passwordHash: await hashPassword(nueva), debeCambiarContrasena: false, contrasenaCambiadaEl: new Date() },
  });
  // Las demás sesiones de la cuenta (otro equipo, una pestaña olvidada) se
  // cierran: si alguien más conocía la contraseña anterior, ya no entra.
  await prisma.sesionActiva.deleteMany({ where: { userId: usuario.userId, NOT: { id: usuario.sesionId } } });
  await registrarAcceso({ evento: "CAMBIO_CONTRASENA", username: usuario.username, userId: usuario.userId });

  const session = await getSession();
  session.debeCambiarContrasena = undefined;
  await session.save();

  redirect(rutaInternaSegura(formData.get("from")) ?? "/dashboard");
}
