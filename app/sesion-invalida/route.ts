import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";

const MOTIVOS = ["cuenta-eliminada", "inactividad", "expirada"];

// Destino de requireUser() (y del cierre por inactividad del navegador) cuando
// la sesión ya no sirve. Tiene que ser un Route Handler y no una página: solo
// aquí se puede borrar la cookie (un Server Component no puede escribir
// cookies), y sin borrarla el navegador volvería a caer en este mismo redirect
// en bucle.
export async function GET(request: NextRequest) {
  const pedido = request.nextUrl.searchParams.get("motivo") ?? "";
  const motivo = MOTIVOS.includes(pedido) ? pedido : "expirada";
  const response = NextResponse.redirect(new URL(`/login?motivo=${motivo}`, request.url));
  response.headers.set("Cache-Control", "no-store");
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  if (session.sesionId) {
    await prisma.sesionActiva.deleteMany({ where: { id: session.sesionId } });
  }
  session.destroy();
  return response;
}
