import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { contarNoLeidos, ultimoNoLeido } from "@/lib/mensajes";
import { contarRojos } from "@/lib/avisos-rojos";

// Lo que el centro de avisos (components/layout/CentroDeAvisos.tsx) consulta
// cada medio minuto: mensajes sin leer y vencimientos en rojo. Ruta "pasiva"
// (ver middleware.ts): no cuenta como actividad de la persona.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const usuario = { userId: session.userId, username: session.username, role: session.role };
  const [noLeidos, ultimo, rojos] = await Promise.all([
    contarNoLeidos(session.userId),
    ultimoNoLeido(session.userId),
    contarRojos(usuario),
  ]);
  return NextResponse.json(
    {
      noLeidos,
      ultimoMensaje: ultimo ? { id: ultimo.id, de: ultimo.deUsername, texto: ultimo.texto.slice(0, 140), canal: ultimo.canal } : null,
      rojos,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
