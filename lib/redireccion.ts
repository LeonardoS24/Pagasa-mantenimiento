import { NextResponse } from "next/server";

// Redirección con Location RELATIVO ("/login"), para los Route Handlers.
//
// NextResponse.redirect(new URL("/login", request.url)) NO sirve aquí:
// scripts/servidor.mjs arranca Next con hostname "0.0.0.0" y Next arma
// request.url en los Route Handlers con ese nombre, no con el de la barra de
// direcciones. El resultado era una redirección a http://0.0.0.0:3000/login:
// en la propia computadora del servidor abre (Windows manda 0.0.0.0 a sí
// misma), pero en cualquier otro equipo, y por el túnel de Cloudflare, el
// navegador marca error al cerrar sesión o al vencer la sesión. Un Location
// relativo lo resuelve el navegador contra la dirección que ya está usando, así
// que funciona igual por http://IP:3000, por HTTPS propio y por el túnel.
export function redireccionRelativa(ruta: string, estado: 303 | 307 = 303): NextResponse {
  return new NextResponse(null, { status: estado, headers: { Location: ruta, "Cache-Control": "no-store" } });
}
