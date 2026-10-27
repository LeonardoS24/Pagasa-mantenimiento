import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession, type IronSession } from "iron-session";
import { sessionOptions, type SessionData, type UsuarioSesion } from "./session";
import { estadoDeVigencia } from "./sesion-vigencia";
import { canEdit, roleSchema } from "./roles";
import { prisma } from "./prisma";
import { parseElevatedAccessSchedule, isWithinElevatedAccessWindow } from "./elevated-access";

// A dónde manda requireUser cuando la sesión ya no sirve (cuenta eliminada,
// inactividad, sesión cerrada o vencida). Esa ruta borra la cookie y regresa
// al login con un aviso.
const RUTA_SESION_INVALIDA = "/sesion-invalida";

export type MotivoSesionPerdida = "inactividad" | "expirada" | "cuenta-eliminada";

// ¿Sigue existiendo la sesión en la base? Cerrar sesión, cambiar la contraseña
// o eliminar la cuenta borran la fila, y con ella dejan de servir las copias
// de la cookie. cache() la deduplica dentro del mismo request.
const sesionExiste = cache(async (sesionId: string, userId: string) => {
  const fila = await prisma.sesionActiva.findUnique({
    where: { id: sesionId },
    select: { userId: true },
  });
  return fila?.userId === userId;
});

// La cookie solo guarda el userId; el usuario pudo haber sido eliminado o
// haber cambiado de rol después de iniciar sesión. Se relee de la base en
// cada request. cache() lo deduplica: aunque el layout, la página y varios
// actions llamen a requireUser, es una sola consulta por request.
const cargarUsuarioDeSesion = cache(async (userId: string) => {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, role: true, puesto: true, debeCambiarContrasena: true },
  });
});

// Lee la sesión y la valida. Si no es vigente (inactividad > 20 min, más de
// 12 h desde que inició o ya no existe en la base) se le quita el userId EN
// MEMORIA: todo el que revisa `session.userId` la trata como sin sesión, sin
// excepciones por olvido. La cookie vieja se borra en /sesion-invalida o en
// el middleware.
export async function leerSesion(): Promise<{
  session: IronSession<SessionData>;
  perdida: MotivoSesionPerdida | null;
}> {
  const session = await getIronSession<SessionData>(cookies(), sessionOptions);
  if (!session.userId) return { session, perdida: null };

  const estado = estadoDeVigencia(session);
  const revocada = estado === "vigente" && !(session.sesionId && (await sesionExiste(session.sesionId, session.userId)));
  if (estado !== "vigente" || revocada) {
    (session as Partial<SessionData>).userId = undefined;
    return { session, perdida: estado === "inactividad" ? "inactividad" : "expirada" };
  }

  // El rol y el nombre de la cookie son los del momento del login. Muchas
  // páginas arman el usuario con `session.role` para revisar el acceso a la
  // ciudad: si a alguien le quitan el rol de ADMIN, la cookie seguiría
  // diciendo ADMIN. Por eso aquí se pisan EN MEMORIA con los de la base.
  const usuario = await cargarUsuarioDeSesion(session.userId);
  if (!usuario) {
    (session as Partial<SessionData>).userId = undefined;
    return { session, perdida: "cuenta-eliminada" };
  }
  const rol = roleSchema.safeParse(usuario.role);
  session.role = rol.success ? rol.data : "LECTOR";
  session.username = usuario.username;

  // Cuenta como actividad: si esta petición guarda la sesión (los avisos de
  // inicio de sesión), la marca nueva viaja en esa cookie.
  session.ultimaActividad = Date.now();
  return { session, perdida: null };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return (await leerSesion()).session;
}

// `aunqueDebaCambiarContrasena`: solo para la página y la acción de cambiar la
// contraseña, que son lo único que se puede usar mientras está pendiente.
export async function requireUser(
  opciones: { aunqueDebaCambiarContrasena?: boolean } = {}
): Promise<UsuarioSesion> {
  const { session, perdida } = await leerSesion();
  if (perdida) {
    redirect(`${RUTA_SESION_INVALIDA}?motivo=${perdida}`);
  }
  if (!session.userId) {
    redirect("/login");
  }

  const user = await cargarUsuarioDeSesion(session.userId);
  if (!user) {
    // La cuenta fue eliminada mientras la sesión seguía abierta en el
    // navegador. Sin esto, la cookie firmada seguiría dando acceso completo
    // hasta que expirara.
    redirect(`${RUTA_SESION_INVALIDA}?motivo=cuenta-eliminada`);
  }
  if (user.debeCambiarContrasena && !opciones.aunqueDebaCambiarContrasena) {
    redirect("/cambiar-contrasena");
  }

  // La base manda sobre la cookie: si a alguien le cambian el rol, el cambio
  // surte efecto en el siguiente request, no al volver a iniciar sesión.
  // El rol se guarda como texto libre, así que ante un valor desconocido se
  // cae al permiso más bajo en vez de asumir algo.
  const rol = roleSchema.safeParse(user.role);
  return {
    userId: user.id,
    sesionId: session.sesionId,
    username: user.username,
    role: rol.success ? rol.data : "LECTOR",
    puesto: user.puesto,
  };
}

export async function requireAdmin(): Promise<UsuarioSesion> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return user;
}

// ADMIN o USUARIO: puede crear/editar números económicos, fichas técnicas,
// bitácoras de mantenimiento y subir archivos. LECTOR queda excluido.
export async function requireEditor(): Promise<UsuarioSesion> {
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
export async function requireElevatedEditor(): Promise<UsuarioSesion> {
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
export async function checkSessionUserExists(user: UsuarioSesion): Promise<string | null> {
  const exists = await prisma.user.findUnique({ where: { id: user.userId }, select: { id: true } });
  if (!exists) {
    return "Tu sesión ya no es válida (tu usuario fue eliminado o recreado). Cierra sesión y vuelve a entrar.";
  }
  return null;
}
