"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { getSession } from "@/lib/auth";
import { roleSchema } from "@/lib/roles";
import { getAccessibleCities } from "@/lib/access";
import { isAggregateCitySlug } from "@/lib/aggregate-city";
import { countInProgressMaintenance } from "@/lib/in-progress-maintenance";
import { countPendingHighPriorityOrders, countValveRedAlerts } from "@/lib/login-alerts";
import { rutaInternaSegura } from "@/lib/ruta-segura";

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

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return { error: "Usuario o contraseña incorrectos." };
  }

  if (user.bloqueadoHasta && user.bloqueadoHasta.getTime() > Date.now()) {
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
    if (bloquear) {
      return {
        error: `Demasiados intentos fallidos. Cuenta bloqueada ${BLOQUEO_MINUTOS} minutos.`,
      };
    }
    return { error: "Usuario o contraseña incorrectos." };
  }

  if (user.intentosFallidosLogin > 0 || user.bloqueadoHasta) {
    await prisma.user.update({
      where: { id: user.id },
      data: { intentosFallidosLogin: 0, bloqueadoHasta: null },
    });
  }

  const role = roleSchema.parse(user.role);

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.role = role;

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

  // Si llegó escaneando el código QR de una unidad (o con un enlace a otra
  // página), vuelve ahí en vez de caer en Inicio.
  redirect(rutaInternaSegura(formData.get("from")) ?? "/dashboard");
}
