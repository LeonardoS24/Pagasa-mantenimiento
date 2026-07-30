import { cookies } from "next/headers";
import { getIronSession, type IronSession } from "iron-session";
import { sessionOptions, type SessionData } from "./session";

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
