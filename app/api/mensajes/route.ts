import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getMensajes, marcarLeido, puedeVerCanal } from "@/lib/mensajes";

// Mensajes de una conversación, para la pantalla /mensajes (la consulta cada
// pocos segundos). Al pedirlos se marcan como leídos. Es una ruta "pasiva"
// (ver middleware.ts): consultarla no cuenta como actividad, así una pantalla
// de mensajes abierta sin usar se cierra a los 20 minutos igual que las demás.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const canal = request.nextUrl.searchParams.get("canal") ?? "";
  if (!puedeVerCanal(session.userId, canal)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const mensajes = await getMensajes(canal);
  await marcarLeido(session.userId, canal);
  return NextResponse.json({ mensajes }, { headers: { "Cache-Control": "no-store" } });
}
