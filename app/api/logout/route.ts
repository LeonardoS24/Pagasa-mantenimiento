import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

// El cierre de sesión es un Route Handler y NO un Server Action a propósito.
// Como el botón vive en el Header (dentro de ProtectedLayout), un Server
// Action con redirect() hacía que Next.js volviera a renderizar el árbol
// protegido con la sesión ya destruida: el layout lanzaba su propio
// redirect("/login") a la vez que el del action, y ese choque reventaba en el
// NotFoundErrorBoundary (error visible al cerrar sesión). Un POST normal a
// esta ruta devuelve un 303 y el navegador navega directo a /login, sin
// re-render intermedio ni redirects en conflicto.
export async function POST(request: NextRequest) {
  // 303 See Other: convierte el POST del formulario en un GET a /login.
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.destroy();
  return response;
}
