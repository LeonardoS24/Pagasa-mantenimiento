import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import { opcionesDeSesion, type SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redireccionRelativa } from "@/lib/redireccion";

// «Ya guardé mis códigos, continuar» (components/cuenta/DobleVerificacionPanel.tsx).
// Quita la marca de «falta activar la doble verificación» de la sesión y manda a
// Inicio. Es un Route Handler y no parte de la acción de activarla a propósito:
// guardar la cookie dentro de una Server Action hace que Next refresque la
// pantalla, y los códigos de recuperación (que se muestran una sola vez)
// desaparecerían antes de que la persona los guardara.
export async function POST(request: NextRequest) {
  const proto = request.headers.get("x-forwarded-proto");
  const response = redireccionRelativa("/dashboard");
  const session = await getIronSession<SessionData>(request, response, opcionesDeSesion(proto));
  if (!session.userId) return redireccionRelativa("/login");

  // Solo se libera si de verdad la activó (lo que dice la base, no la cookie).
  const usuario = await prisma.user.findUnique({ where: { id: session.userId }, select: { totpActivo: true } });
  if (!usuario?.totpActivo) return redireccionRelativa("/doble-verificacion");

  if (session.debeActivar2fa) {
    session.debeActivar2fa = undefined;
    await session.save();
  }
  return response;
}
