"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { verifySessionPassword } from "@/lib/reauth";
import { registrarAcceso } from "@/lib/registro-acceso";
import { cifrarSecreto, descifrarSecreto } from "@/lib/secretos";
import { exige2faAAdmins } from "@/lib/doble-verificacion";
import { BLOQUEO_MINUTOS, MAX_INTENTOS_FALLIDOS, acierto, fallo, reservarIntentoDeCuenta } from "@/lib/freno-intentos";
import { huellaDeCodigoRespaldo, nuevoSecretoTotp, nuevosCodigosRespaldo, verificarTotp } from "@/lib/totp";

// Activar, quitar y restablecer la doble verificación (lib/totp.ts tiene los
// códigos; el segundo paso del inicio de sesión está en auth-actions.ts).

export type DobleVerificacionState = { error?: string; codigos?: string[]; mensaje?: string };

// Mientras la empresa la exige a los administradores, hay que poder llegar a
// activarla (aunqueFalte2fa) aunque todavía no esté activa.
async function usuarioActual() {
  return requireUser({ aunqueFalte2fa: true });
}

// Empieza la activación: crea un secreto nuevo (cifrado en la base) que solo
// vale cuando la persona confirma con un código de su aplicación.
export async function iniciarActivacion(): Promise<DobleVerificacionState> {
  const usuario = await usuarioActual();
  const registro = await prisma.user.findUnique({ where: { id: usuario.userId }, select: { totpActivo: true } });
  if (registro?.totpActivo) return { error: "La doble verificación ya está activa." };
  await prisma.user.update({ where: { id: usuario.userId }, data: { totpSecreto: cifrarSecreto(nuevoSecretoTotp()), totpPaso: null, totpRespaldo: null } });
  revalidatePath("/doble-verificacion");
  return {};
}

export async function confirmarActivacion(_prev: DobleVerificacionState, formData: FormData): Promise<DobleVerificacionState> {
  const usuario = await usuarioActual();
  const registro = await prisma.user.findUnique({ where: { id: usuario.userId }, select: { totpActivo: true, totpSecreto: true } });
  if (!registro) return { error: "Tu cuenta ya no existe." };
  if (registro.totpActivo) return { error: "La doble verificación ya está activa." };
  const secreto = descifrarSecreto(registro.totpSecreto);
  if (!secreto) return { error: "Primero pulsa «Empezar» para generar el código QR." };

  const v = verificarTotp(secreto, String(formData.get("codigo") ?? ""));
  if (!v.ok) return { error: "El código no es correcto. Revisa que la hora del teléfono sea la correcta e intenta con el código nuevo." };

  const codigos = nuevosCodigosRespaldo(8);
  await prisma.user.update({
    where: { id: usuario.userId },
    data: { totpActivo: true, totpPaso: v.paso, totpRespaldo: JSON.stringify(codigos.map(huellaDeCodigoRespaldo)) },
  });
  await registrarAcceso({ evento: "DOBLE_VERIFICACION_ACTIVADA", username: usuario.username, userId: usuario.userId });

  // Aquí NO se toca la cookie ni se revalida la pantalla a propósito: cualquiera
  // de las dos refresca la página, que pasaría a «Está activa», y los códigos de
  // recuperación (que se muestran esta única vez; en la base solo queda su
  // huella) desaparecerían antes de que la persona los guardara. Quitar la
  // marca de «falta activar» de la sesión lo hace «Continuar»
  // (app/api/doble-verificacion/listo/route.ts).
  return { codigos };
}

// Quitarla pide la contraseña y un código vigente, con el mismo freno de
// intentos que el inicio de sesión. Si la empresa la exige a los
// administradores, ellos no pueden quitarla.
export async function quitarDobleVerificacion(_prev: DobleVerificacionState, formData: FormData): Promise<DobleVerificacionState> {
  const usuario = await usuarioActual();
  if (exige2faAAdmins() && usuario.role === "ADMIN") {
    return { error: "La empresa exige la doble verificación a los administradores: no se puede quitar." };
  }
  const registro = await prisma.user.findUnique({
    where: { id: usuario.userId },
    select: { passwordHash: true, totpActivo: true, totpSecreto: true, totpPaso: true },
  });
  if (!registro?.totpActivo) return { error: "La doble verificación no está activa." };

  const reserva = await reservarIntentoDeCuenta(usuario.userId);
  if (!reserva.permitido) return { error: "Tu cuenta está bloqueada por varios intentos fallidos. Espera unos minutos." };

  const secreto = descifrarSecreto(registro.totpSecreto);
  const claveCorrecta = await verifyPassword(String(formData.get("password") ?? ""), registro.passwordHash);
  const v = secreto ? verificarTotp(secreto, String(formData.get("codigo") ?? ""), { ultimoPaso: registro.totpPaso }) : ({ ok: false } as const);
  if (!claveCorrecta || !v.ok) {
    await registrarAcceso({
      evento: "INTENTO_FALLIDO",
      username: usuario.username,
      userId: usuario.userId,
      detalle: "Contraseña o código incorrectos al querer quitar la doble verificación",
    });
    if (await fallo(usuario.userId, reserva.numero)) {
      await prisma.sesionActiva.deleteMany({ where: { userId: usuario.userId } });
      await registrarAcceso({
        evento: "CUENTA_BLOQUEADA",
        username: usuario.username,
        userId: usuario.userId,
        detalle: `${MAX_INTENTOS_FALLIDOS} intentos fallidos al quitar la doble verificación: bloqueada ${BLOQUEO_MINUTOS} minutos`,
      });
      return { error: "Demasiados intentos. La cuenta quedó bloqueada y se cerró la sesión." };
    }
    return { error: "La contraseña o el código no son correctos." };
  }
  await acierto(usuario.userId);

  await prisma.user.update({ where: { id: usuario.userId }, data: { totpActivo: false, totpSecreto: null, totpPaso: null, totpRespaldo: null } });
  await registrarAcceso({ evento: "DOBLE_VERIFICACION_QUITADA", username: usuario.username, userId: usuario.userId });
  revalidatePath("/doble-verificacion");
  return { mensaje: "Listo: la doble verificación quedó desactivada." };
}

// Para quien perdió el teléfono y sus códigos de recuperación: un
// administrador la restablece (confirmando con su contraseña) y la persona
// la activa de nuevo.
export async function restablecerDobleVerificacion(userId: string, password: string): Promise<DobleVerificacionState> {
  const admin = await requireAdmin();
  const error = await verifySessionPassword(admin, password);
  if (error) return { error };
  const objetivo = await prisma.user.findUnique({ where: { id: userId }, select: { username: true, totpActivo: true } });
  if (!objetivo) return { error: "La cuenta ya no existe." };
  await prisma.user.update({ where: { id: userId }, data: { totpActivo: false, totpSecreto: null, totpPaso: null, totpRespaldo: null } });
  await registrarAcceso({
    evento: "DOBLE_VERIFICACION_RESTABLECIDA",
    username: objetivo.username,
    userId,
    actorUsername: admin.username,
  });
  revalidatePath(`/admin/usuarios/${userId}`);
  return { mensaje: `Se restableció la doble verificación de ${objetivo.username}.` };
}
