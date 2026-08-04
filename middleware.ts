import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

export const config = {
  // sesion-invalida queda fuera: es la ruta que borra una cookie cuya cuenta
  // ya no existe, y el middleware (que solo mira la cookie) la daría por
  // válida y la dejaría pasar igual, o la desviaría antes de poder limpiarla.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logos/|login|sesion-invalida).*)"],
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  if (!session.userId) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname.startsWith("/admin") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}
