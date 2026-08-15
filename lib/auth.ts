import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession, type IronSession } from "iron-session";
import { sessionOptions, type SessionData } from "./session";
import { canEdit, roleSchema } from "./roles";
import { prisma } from "./prisma";
import { parseElevatedAccessSchedule, isWithinElevatedAccessWindow } from "./elevated-access";

// A dónde manda requireUser cuando la cuenta de la cookie ya no sirve. Esa
// ruta borra la cookie y regresa al login con un aviso.
const RUTA_SESION_INVALIDA = "/sesion-invalida";

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}

// La cookie solo guarda el userId; el usuario pudo haber sido eliminado o
// haber cambiado de rol después de iniciar sesión. Se relee de la base en
// cada request. cache() lo deduplica: aunque el layout, la página y varios
// actions llamen a requireUser, es una sola consulta por request.
const cargarUsuarioDeSesion = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true, puesto: true },
  });
});

export async function requireUser(): Promise<SessionData> {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const user = await cargarUsuarioDeSesion(session.userId);
  if (!user) {
    // La cuenta fue eliminada mientras la sesión seguía abierta en el
    // navegador. Sin esto, la cookie firmada seguiría dando acceso completo
    // hasta que expirara.
    redirect(RUTA_SESION_INVALIDA);
  }

  // La base manda sobre la cookie: si a alguien le cambian el rol, el cambio
  // surte efecto en el siguiente request, no al volver a iniciar sesión.
  // El rol se guarda como texto libre, así que ante un valor desconocido se
  // cae al permiso más bajo en vez de asumir algo.
  const rol = roleSchema.safeParse(user.role);
  return {
    userId: user.id,
    username: user.username,
    role: rol.success ? rol.data : "LECTOR",
    puesto: user.puesto,
  };
}

export async function requireAdmin(): Promise<SessionData> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return user;
}

// ADMIN o USUARIO: puede crear/editar números económicos, fichas técnicas,
// bitácoras de mantenimiento y subir archivos. LECTOR queda excluido.
export async function requireEditor(): Promise<SessionData> {
  const user = await requireUser();
  if (!canEdit(user.role)) {
    throw new Error("Se requiere rol ADMIN o USUARIO");
  }
  return user;
}

// Como requireAdmin, pero un USUARIO con acceso ampliado activo en este
// momento (ver lib/elevated-access.ts) también pasa. Se usa en las acciones
// que editan/borran registros de negocio (mantenimientos, ficha técnica,
// documentos, inventario, órdenes, equipos) — NUNCA en las de usuarios,
// ciudades o apartados, que siguen exigiendo requireAdmin a secas sin
// importar la hora.
export async function requireElevatedEditor(): Promise<SessionData> {
  const user = await requireUser();
  if (user.role === "ADMIN") return user;

  if (user.role === "USUARIO") {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: { accesoAmpliadoDias: true, accesoAmpliadoHoraInicio: true, accesoAmpliadoHoraFin: true },
    });
    const schedule = dbUser ? parseElevatedAccessSchedule(dbUser) : null;
    if (schedule && isWithinElevatedAccessWindow(schedule)) {
      return user;
    }
  }

  redirect("/dashboard");
}

// Red de seguridad para los actions que escriben usando session.userId como
// llave foránea. requireUser ya revalida la cuenta contra la base, así que
// esto solo alcanza a disparar si la cuenta se elimina entre esa lectura y
// la escritura; devuelve un mensaje claro en vez de un error de base.
export async function checkSessionUserExists(user: SessionData): Promise<string | null> {
  const exists = await prisma.user.findUnique({ where: { id: user.userId }, select: { id: true } });
  if (!exists) {
    return "Tu sesión ya no es válida (tu usuario fue eliminado o recreado). Cierra sesión y vuelve a entrar.";
  }
  return null;
}
