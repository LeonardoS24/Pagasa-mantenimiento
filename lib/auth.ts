import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { sessionOptions, type SessionData } from "./session";
import { canEdit } from "./roles";
import { prisma } from "./prisma";

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}

export async function requireUser(): Promise<SessionData> {
  const session = await getSession();
  if (!session.userId) {
    throw new Error("No autenticado");
  }
  return { userId: session.userId, username: session.username, role: session.role };
}

export async function requireAdmin(): Promise<SessionData> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Se requiere rol ADMIN");
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

// La sesión (cookie) solo guarda el userId, no lo revalida contra la base de
// datos en cada request. Si esa cuenta fue eliminada mientras la sesión
// seguía activa en el navegador, cualquier escritura que use session.userId
// como llave foránea (bitácora, documentos, etc.) fallaría con un error de
// base de datos poco claro. Los actions que escriben con `by`/`createdById`
// deben llamar esto justo antes de escribir y devolver el mensaje como error.
export async function checkSessionUserExists(user: SessionData): Promise<string | null> {
  const exists = await prisma.user.findUnique({ where: { id: user.userId }, select: { id: true } });
  if (!exists) {
    return "Tu sesión ya no es válida (tu usuario fue eliminado o recreado). Cierra sesión y vuelve a entrar.";
  }
  return null;
}
