import { NextResponse } from "next/server";

// Latido de la sesión: InactividadGuard lo llama mientras la persona está
// usando la pantalla. El middleware ya renovó la marca de actividad cuando
// llega aquí (si la sesión venció, lo manda al login y ni entra); esta ruta
// solo contesta.
export async function GET() {
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
