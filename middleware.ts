import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";
import { RENOVAR_CADA_MS, estadoDeVigencia } from "@/lib/sesion-vigencia";

export const config = {
  // sesion-invalida queda fuera: es la ruta que borra una cookie cuya cuenta
  // ya no existe, y el middleware (que solo mira la cookie) la daría por
  // válida y la dejaría pasar igual, o la desviaría antes de poder limpiarla.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logos/|login|sesion-invalida).*)"],
};

// El middleware solo ve la cookie (no hay Prisma en el edge): aquí se corta lo
// que se nota sin base de datos (sin sesión, 20 min de inactividad, 12 h de
// tope) y se renueva la marca de actividad. Que la sesión siga existiendo en
// la base (cerrar sesión la revoca) lo revisa getSession en lib/auth.ts.
export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  const aLogin = (motivo?: string) => {
    const loginUrl = new URL("/login", request.url);
    if (motivo) loginUrl.searchParams.set("motivo", motivo);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  };

  if (!session.userId || !session.sesionId) {
    return aLogin();
  }

  const estado = estadoDeVigencia(session);
  if (estado !== "vigente") {
    const salida = aLogin(estado === "inactividad" ? "inactividad" : "expirada");
    salida.headers.set("Cache-Control", "no-store");
    // Se borra la cookie vencida para que no quede dando vueltas.
    const vencida = await getIronSession<SessionData>(request, salida, sessionOptions);
    vencida.destroy();
    return salida;
  }

  if (request.nextUrl.pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const ahora = Date.now();
  if (ahora - session.ultimaActividad > RENOVAR_CADA_MS) {
    session.ultimaActividad = ahora;
    await session.save();
  }

  // Nada de lo que hay dentro se guarda en el caché del navegador: con el
  // botón "atrás" después de cerrar sesión no debe reaparecer una pantalla.
  response.headers.set("Cache-Control", "no-store");
  return response;
}
