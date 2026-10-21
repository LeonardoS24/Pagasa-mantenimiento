import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAggregateCitySlug, getAllRealCityIds } from "@/lib/aggregate-city";
import { TIPOS_VENCIMIENTO, getVencimientos } from "@/lib/vencimientos";
import { construirIcs } from "@/lib/vencimientos-ics";

// Calendario de vencimientos en formato .ics. Solo lectura, así que basta con
// que el usuario pueda ver la ciudad (también LECTOR).
export async function GET(request: NextRequest, { params }: { params: { citySlug: string } }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  const usuario = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, role: true } });
  if (!usuario) {
    return NextResponse.json({ error: "Sesión no válida" }, { status: 401 });
  }
  const city = await prisma.city.findUnique({ where: { slug: params.citySlug } });
  if (!city) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  if (usuario.role !== "ADMIN") {
    const access = await prisma.userCityAccess.findUnique({
      where: { userId_cityId: { userId: usuario.id, cityId: city.id } },
    });
    if (!access) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }
  }

  const esAgregada = isAggregateCitySlug(city.slug);
  const cityIds = esAgregada ? await getAllRealCityIds() : [city.id];
  const tipo = TIPOS_VENCIMIENTO.find((t) => t.tipo === request.nextUrl.searchParams.get("tipo"))?.tipo;
  const ciudad = request.nextUrl.searchParams.get("ciudad");

  // Los ya vencidos hace más de 90 días no se mandan al calendario del usuario.
  const lista = (await getVencimientos(cityIds)).filter(
    (v) => v.dias >= -90 && (!tipo || v.tipo === tipo) && (!ciudad || v.citySlug === ciudad)
  );
  const nombre = `Vencimientos Pagasa - ${city.name}`;
  const nombreArchivo = `${nombre}.ics`;

  return new NextResponse(construirIcs(lista, nombre), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="vencimientos-pagasa.ics"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
