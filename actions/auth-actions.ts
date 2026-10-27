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
import {
  datosDelCliente,
  intentosFallidosDesdeIp,
  registrarAcceso,
} from "@/lib/registro-acceso";

const loginSchema = z.object({
  username: z.string().min(1, "Ingresa tu usuario"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export interface LoginState {
  error?: string;
}

// Protección contra fuerza bruta: 5 intentos fallidos seguidos bloquean la
// cuenta 15 minutos. Un intento correcto reinicia el contador; un bloqueo
// vencido también se limpia solo al siguiente intento.
const MAX_INTENTOS_FALLIDOS = 5;
const BLOQUEO_MINUTOS = 15;

// Además del bloqueo por cuenta: muchos intentos fallidos desde un mismo
// equipo (probando usuarios distintos, que el bloqueo por cuenta no frena)
// cortan los intentos de ese equipo un rato.
const MAX_FALLIDOS_POR_EQUIPO = 20;
const VENTANA_EQUIPO_MINUTOS = 15;

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

  if (cliente.ip && (await intentosFallidosDesdeIp(cliente.ip, VENTANA_EQUIPO_MINUTOS)) >= MAX_FALLIDOS_POR_EQUIPO) {
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

  if (user.bloqueadoHasta && user.bloqueadoHasta.getTime() > Date.now()) {
    await registrarAcceso({ evento: "INTENTO_CUENTA_BLOQUEADA", username, userId: user.id, cliente });
    return {
      error: `Cuenta bloqueada temporalmente por varios intentos fallidos. Intenta de nuevo en ${minutosRestantes(user.bloqueadoHasta)} minuto(s).`,
    };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    const intentos = user.intentosFallidosLogin + 1;
    const bloquear = intentos >= MAX_INTENTOS_FALLIDOS;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        intentosFallidosLogin: bloquear ? 0 : intentos,
        bloqueadoHasta: bloquear ? new Date(Date.now() + BLOQUEO_MINUTOS * 60 * 1000) : null,
      },
    });
    await registrarAcceso({ evento: "INTENTO_FALLIDO", username, userId: user.id, detalle: "Contraseña incorrecta", cliente });
    if (bloquear) {
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

  if (user.intentosFallidosLogin > 0 || user.bloqueadoHasta) {
    await prisma.user.update({
      where: { id: user.id },
      data: { intentosFallidosLogin: 0, bloqueadoHasta: null },
    });
  }

  const role = roleSchema.parse(user.role);

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
    data: { userId: user.id, ip: cliente.ip, navegador: cliente.navegador },
  });
  const ahora = Date.now();
  session.userId = user.id;
  session.sesionId = sesionActiva.id;
  session.iniciadaEl = ahora;
  session.ultimaActividad = ahora;
  session.username = user.username;
  session.role = role;
  session.debeCambiarContrasena = debeCambiar || undefined;

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
    const desde = rutaInternaSegura(formData.get("from"));
    redirect(desde ? `/cambiar-contrasena?from=${encodeURIComponent(desde)}` : "/cambiar-contrasena");
  }

  // Si llegó escaneando el código QR de una unidad (o con un enlace a otra
  // página), vuelve ahí en vez de caer en Inicio.
  redirect(rutaInternaSegura(formData.get("from")) ?? "/dashboard");
}
