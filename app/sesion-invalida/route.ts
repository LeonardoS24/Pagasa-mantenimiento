import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

// Destino de requireUser() cuando la cuenta de la cookie ya no existe en la
// base. Tiene que ser un Route Handler y no una página: solo aquí se puede
// borrar la cookie (un Server Component no puede escribir cookies), y sin
// borrarla el navegador volvería a caer en este mismo redirect en bucle.
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(
    new URL("/login?motivo=cuenta-eliminada", request.url)
  );
  const session = await getIronSession<SessionData>(request, response, sessionOptions);
  session.destroy();
  return response;
}
