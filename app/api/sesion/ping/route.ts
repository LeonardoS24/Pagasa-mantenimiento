import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Latido de la sesión: InactividadGuard lo llama mientras la persona está
// usando la pantalla. El middleware ya renovó la marca de actividad de la
// cookie cuando llega aquí (si la sesión venció, lo manda al login y ni
// entra); aquí se anota también en la base, para la lista de sesiones
// abiertas de /admin/accesos.
export async function GET() {
  const session = await getSession();
  if (session.userId && session.sesionId) {
    await prisma.sesionActiva.updateMany({ where: { id: session.sesionId }, data: { ultimaActividad: new Date() } });
  }
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
