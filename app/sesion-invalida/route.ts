import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { rutaInternaSegura } from "@/lib/ruta-segura";
import { registrarAcceso, type EventoAcceso } from "@/lib/registro-acceso";

const MOTIVOS = ["cuenta-eliminada", "inactividad", "expirada"];
const EVENTO_DE_MOTIVO: Record<string, EventoAcceso | undefined> = {
  inactividad: "CIERRE_INACTIVIDAD",
  expirada: "SESION_EXPIRADA",
};

// Destino de requireUser(), del middleware y del cierre por inactividad del
// navegador cuando la sesión ya no sirve. Tiene que ser un Route Handler y no
// una página: solo aquí se puede borrar la cookie (un Server Component no
// puede escribir cookies), y sin borrarla el navegador volvería a caer en este
// mismo redirect en bucle.
export async function GET(request: NextRequest) {
  const pedido = request.nextUrl.searchParams.get("motivo") ?? "";
  const motivo = MOTIVOS.includes(pedido) ? pedido : "expirada";
  const login = new URL("/login", request.url);
  login.searchParams.set("motivo", motivo);
  const desde = rutaInternaSegura(request.nextUrl.searchParams.get("from"));
  if (desde) login.searchParams.set("from", desde);

  const response = NextResponse.redirect(login);
  response.headers.set("Cache-Control", "no-store");
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  if (session.sesionId) {
    const { count } = await prisma.sesionActiva.deleteMany({ where: { id: session.sesionId } });
    // Solo se anota si la sesión seguía viva: así una pestaña vieja que
    // vuelve a caer aquí no repite el registro.
    const evento = EVENTO_DE_MOTIVO[motivo];
    if (count > 0 && evento && session.userId) {
      await registrarAcceso({ evento, username: session.username ?? "?", userId: session.userId });
    }
  }
  session.destroy();
  return response;
}
