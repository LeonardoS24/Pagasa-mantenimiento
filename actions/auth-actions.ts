"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getSession } from "@/lib/auth";
import { roleSchema } from "@/lib/roles";
import { getAccessibleCities } from "@/lib/access";
import { isAggregateCitySlug } from "@/lib/aggregate-city";
import { countInProgressMaintenance } from "@/lib/in-progress-maintenance";
import { countPendingHighPriorityOrders, countValveRedAlerts } from "@/lib/login-alerts";
import { rutaInternaSegura } from "@/lib/ruta-segura";
import { DURACION_MAXIMA_MS } from "@/lib/sesion-vigencia";
import { problemaDeContrasena } from "@/lib/politica-contrasena";
import { datosDelCliente, registrarAcceso } from "@/lib/registro-acceso";
import { falta2fa } from "@/lib/doble-verificacion";
import { borrarPendiente2fa, guardarPendiente2fa, leerPendiente2fa } from "@/lib/pendiente-2fa";
import { descifrarSecreto } from "@/lib/secretos";
import { consumirCodigoRespaldo, leerHuellas, pareceCodigoRespaldo, verificarTotp } from "@/lib/totp";
import {
  BLOQUEO_MINUTOS,
  MAX_INTENTOS_FALLIDOS,
  VENTANA_EQUIPO_MINUTOS,
  acierto,
  devolverIntentoDeCuenta,
  fallo,
  liberarIntentoDeEquipo,
  reservarIntentoDeCuenta,
  reservarIntentoDeEquipo,
} from "@/lib/freno-intentos";

const loginSchema = z.object({
  username: z.string().min(1, "Ingresa tu usuario"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export interface LoginState {
  error?: string;
}

// Protección contra fuerza bruta: 5 intentos fallidos seguidos bloquean la
// cuenta 15 minutos, y 20 desde un mismo equipo lo frenan 15 minutos (ver
// lib/freno-intentos.ts, que aparta cada intento antes de comparar).

// Hash de una contraseña cualquiera. Cuando el usuario no existe se compara
// contra este para tardar lo mismo que con uno que sí existe: si no, el
// tiempo de respuesta delata qué usuarios hay.
let hashSenuelo: Promise<string> | null = null;
function getHashSenuelo(): Promise<string> {
  hashSenuelo ??= hashPassword(`senuelo-${Math.random()}`);
  return hashSenuelo;
}

function minutosRestantes(bloqueadoHasta: Date): number {
  return Math.max(1, Math.ceil((bloqueadoHasta.getTime() - Date.now()) / 60000));
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
  const cliente = datosDelCliente();

  if (!reservarIntentoDeEquipo(cliente.ip)) {
    const yaAnotado = await prisma.registroAcceso.count({
      where: { ip: cliente.ip, evento: "BLOQUEO_POR_EQUIPO", createdAt: { gte: new Date(Date.now() - VENTANA_EQUIPO_MINUTOS * 60 * 1000) } },
    });
    if (!yaAnotado) await registrarAcceso({ evento: "BLOQUEO_POR_EQUIPO", username, cliente });
    return { error: `Demasiados intentos fallidos desde este equipo. Espera ${VENTANA_EQUIPO_MINUTOS} minutos.` };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    await verifyPassword(password, await getHashSenuelo());
    await registrarAcceso({ evento: "INTENTO_FALLIDO", username, detalle: "El usuario no existe", cliente });
    return { error: "Usuario o contraseña incorrectos." };
  }

  // El intento se aparta ANTES de comparar (ver lib/freno-intentos.ts).
  const reserva = await reservarIntentoDeCuenta(user.id);
  if (!reserva.permitido) {
    await registrarAcceso({ evento: "INTENTO_CUENTA_BLOQUEADA", username, userId: user.id, cliente });
    return {
      error: `Cuenta bloqueada temporalmente por varios intentos fallidos. Intenta de nuevo en ${minutosRestantes(reserva.bloqueadoHasta)} minuto(s).`,
    };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await registrarAcceso({ evento: "INTENTO_FALLIDO", username, userId: user.id, detalle: "Contraseña incorrecta", cliente });
    if (await fallo(user.id, reserva.numero)) {
      await registrarAcceso({
        evento: "CUENTA_BLOQUEADA",
        username,
        userId: user.id,
        detalle: `${MAX_INTENTOS_FALLIDOS} intentos fallidos seguidos: bloqueada ${BLOQUEO_MINUTOS} minutos`,
        cliente,
      });
      return {
        error: `Demasiados intentos fallidos. Cuenta bloqueada ${BLOQUEO_MINUTOS} minutos.`,
      };
    }
    return { error: "Usuario o contraseña incorrectos." };
  }
  // Una contraseña que ya no cumple la política (las de antes de que
  // existiera, o la temporal del alta) obliga a cambiarla antes de entrar.
  const debeCambiar = user.debeCambiarContrasena || problemaDeContrasena(password, user.username) !== null;
  if (debeCambiar && !user.debeCambiarContrasena) {
    await prisma.user.update({ where: { id: user.id }, data: { debeCambiarContrasena: true } });
  }
  const desde = rutaInternaSegura(formData.get("from"));

  // Con doble verificación la contraseña sola todavía no abre la sesión. El
  // intento que se apartó para compararla se devuelve (acertar la contraseña
  // no es un acceso) y el segundo paso aparta y cuenta los suyos, así que
  // quien conoce la contraseña tampoco puede probar códigos sin límite.
  if (user.totpActivo && user.totpSecreto) {
    await devolverIntentoDeCuenta(user.id);
    liberarIntentoDeEquipo(cliente.ip);
    await guardarPendiente2fa({ userId: user.id, desde, debeCambiar });
    redirect("/login/verificar");
  }

  await acierto(user.id);
  liberarIntentoDeEquipo(cliente.ip);
  return abrirSesion(user, { cliente, debeCambiar, desde });
}

// El segundo paso del inicio de sesión: el código de 6 dígitos de la
// aplicación o uno de los códigos de recuperación.
export async function verificarCodigoAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const pendiente = await leerPendiente2fa();
  if (!pendiente) redirect("/login?motivo=expirada");
  const cliente = datosDelCliente();
  const codigo = String(formData.get("codigo") ?? "").trim();
  if (!codigo) return { error: "Escribe el código." };

  if (!reservarIntentoDeEquipo(cliente.ip)) {
    return { error: `Demasiados intentos fallidos desde este equipo. Espera ${VENTANA_EQUIPO_MINUTOS} minutos.` };
  }
  const user = await prisma.user.findUnique({ where: { id: pendiente.userId } });
  if (!user || !user.totpActivo || !user.totpSecreto) {
    await borrarPendiente2fa();
    redirect("/login");
  }
  const reserva = await reservarIntentoDeCuenta(user.id);
  if (!reserva.permitido) {
    await registrarAcceso({ evento: "INTENTO_CUENTA_BLOQUEADA", username: user.username, userId: user.id, cliente });
    return {
      error: `Cuenta bloqueada temporalmente por varios intentos fallidos. Intenta de nuevo en ${minutosRestantes(reserva.bloqueadoHasta)} minuto(s).`,
    };
  }

  let acertado = false;
  let restantesRespaldo: number | null = null;
  if (pareceCodigoRespaldo(codigo)) {
    const uso = consumirCodigoRespaldo(leerHuellas(user.totpRespaldo), codigo);
    if (uso.ok) {
      // updateMany con el valor leído: si dos intentos usan el mismo código a
      // la vez, solo uno lo consume.
      const { count } = await prisma.user.updateMany({
        where: { id: user.id, totpRespaldo: user.totpRespaldo },
        data: { totpRespaldo: JSON.stringify(uso.restantes) },
      });
      acertado = count === 1;
      if (acertado) restantesRespaldo = uso.restantes.length;
    }
  } else {
    const secreto = descifrarSecreto(user.totpSecreto);
    const v = secreto ? verificarTotp(secreto, codigo, { ultimoPaso: user.totpPaso }) : ({ ok: false } as const);
    if (v.ok) {
      // Un código solo sirve una vez: el paso se guarda de forma atómica.
      const { count } = await prisma.user.updateMany({
        where: { id: user.id, OR: [{ totpPaso: null }, { totpPaso: { lt: v.paso } }] },
        data: { totpPaso: v.paso },
      });
      acertado = count === 1;
    }
  }

  if (!acertado) {
    await registrarAcceso({ evento: "INTENTO_FALLIDO", username: user.username, userId: user.id, detalle: "Código de doble verificación incorrecto", cliente });
    if (await fallo(user.id, reserva.numero)) {
      await registrarAcceso({
        evento: "CUENTA_BLOQUEADA",
        username: user.username,
        userId: user.id,
        detalle: `${MAX_INTENTOS_FALLIDOS} intentos fallidos seguidos: bloqueada ${BLOQUEO_MINUTOS} minutos`,
        cliente,
      });
      await borrarPendiente2fa();
      return { error: `Demasiados intentos fallidos. Cuenta bloqueada ${BLOQUEO_MINUTOS} minutos.` };
    }
    return { error: "El código no es correcto. Revisa que la hora del teléfono sea la correcta y vuelve a intentar." };
  }

  await acierto(user.id);
  liberarIntentoDeEquipo(cliente.ip);
  await borrarPendiente2fa();
  if (restantesRespaldo !== null) {
    await registrarAcceso({
      evento: "CODIGO_RESPALDO_USADO",
      username: user.username,
      userId: user.id,
      detalle: `Quedan ${restantesRespaldo} códigos de recuperación`,
      cliente,
    });
  }
  return abrirSesion(user, { cliente, debeCambiar: pendiente.debeCambiar, desde: pendiente.desde });
}

// Crea la sesión (ya con contraseña y, si la tiene, doble verificación
// correctas), arma los avisos de inicio y manda a donde toca.
async function abrirSesion(
  user: { id: string; username: string; role: string; avisosMantenimientoActivos: boolean; totpActivo: boolean },
  { cliente, debeCambiar, desde }: { cliente: { ip: string | null; navegador: string | null }; debeCambiar: boolean; desde: string | null }
): Promise<never> {
  const role = roleSchema.parse(user.role);
  // La empresa puede exigirla a los administradores (EXIGIR_2FA_ADMIN).
  const pideActivarla = falta2fa({ role, totpActivo: user.totpActivo });

  const session = await getSession();
  // Si este navegador traía otra sesión, se cierra: cada inicio es desde cero.
  if (session.sesionId) {
    await prisma.sesionActiva.deleteMany({ where: { id: session.sesionId } });
  }
  // De paso se limpian las sesiones que ya pasaron el tope de duración.
  await prisma.sesionActiva.deleteMany({
    where: { creadaEl: { lt: new Date(Date.now() - DURACION_MAXIMA_MS) } },
  });
  const sesionActiva = await prisma.sesionActiva.create({
    data: { userId: user.id, ip: cliente.ip, navegador: cliente.navegador, ultimaActividad: new Date() },
  });
  const ahora = Date.now();
  session.userId = user.id;
  session.sesionId = sesionActiva.id;
  session.iniciadaEl = ahora;
  session.ultimaActividad = ahora;
  session.username = user.username;
  session.role = role;
  session.debeCambiarContrasena = debeCambiar || undefined;
  session.debeActivar2fa = pideActivarla || undefined;

  const cities = await getAccessibleCities({ userId: user.id, username: user.username, role });
  const cityIds = cities.filter((c) => !isAggregateCitySlug(c.slug)).map((c) => c.id);

  if (user.avisosMantenimientoActivos) {
    const count = await countInProgressMaintenance(cityIds);
    if (count > 0) {
      session.pendingInProgressCount = count;
    }
  }

  const highPriorityOrderCount = await countPendingHighPriorityOrders(cityIds);
  if (highPriorityOrderCount > 0) {
    session.pendingHighPriorityOrderCount = highPriorityOrderCount;
  }

  const valveRedAlertCount = await countValveRedAlerts(cityIds);
  if (valveRedAlertCount > 0) {
    session.pendingValveRedAlertCount = valveRedAlertCount;
  }

  await session.save();
  await registrarAcceso({ evento: "INICIO_SESION", username: user.username, userId: user.id, cliente });

  if (debeCambiar) {
    redirect(desde ? `/cambiar-contrasena?from=${encodeURIComponent(desde)}` : "/cambiar-contrasena");
  }
  if (pideActivarla) redirect("/doble-verificacion");

  // Si llegó escaneando el código QR de una unidad (o con un enlace a otra
  // página), vuelve ahí en vez de caer en Inicio.
  redirect(desde ?? "/dashboard");
}
