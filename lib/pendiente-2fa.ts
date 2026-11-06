import { cookies, headers } from "next/headers";
import { getIronSession } from "iron-session";
import { opcionesDeSesion } from "./session";

// Entre la contraseña y el código de la doble verificación la persona todavía
// NO tiene sesión: solo una marca firmada, en otra cookie, que dura 5 minutos
// y dice a quién le falta el segundo paso. No sirve para entrar a nada.
const VIGENCIA_MS = 5 * 60 * 1000;

type Pendiente = { userId?: string; hasta?: number; desde?: string | null; debeCambiar?: boolean };

async function cookiePendiente() {
  const base = opcionesDeSesion(headers().get("x-forwarded-proto"));
  return getIronSession<Pendiente>(cookies(), { ...base, cookieName: "pagasa_2fa" });
}

export async function guardarPendiente2fa(datos: { userId: string; desde: string | null; debeCambiar: boolean }): Promise<void> {
  const c = await cookiePendiente();
  c.userId = datos.userId;
  c.hasta = Date.now() + VIGENCIA_MS;
  c.desde = datos.desde;
  c.debeCambiar = datos.debeCambiar;
  await c.save();
}

export async function leerPendiente2fa(): Promise<{ userId: string; desde: string | null; debeCambiar: boolean } | null> {
  const c = await cookiePendiente();
  if (!c.userId || !c.hasta || c.hasta < Date.now()) return null;
  return { userId: c.userId, desde: c.desde ?? null, debeCambiar: c.debeCambiar === true };
}

export async function borrarPendiente2fa(): Promise<void> {
  const c = await cookiePendiente();
  c.destroy();
}
