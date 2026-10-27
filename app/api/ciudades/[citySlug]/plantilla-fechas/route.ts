import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idsDeTrabajo } from "@/lib/ciudades-de-trabajo";
import { armarPlantilla } from "@/lib/carga-fechas-servidor";

// Plantilla de Excel con las fechas actuales de las unidades de la ciudad,
// para llenarla y subirla en "Carga de fechas" (ver lib/carga-fechas.ts).
export async function GET(_request: NextRequest, { params }: { params: { citySlug: string } }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const city = await prisma.city.findUnique({ where: { slug: params.citySlug } });
  if (!city) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const user = { userId: session.userId, username: session.username, role: session.role };
  if (user.role !== "ADMIN") {
    const acceso = await prisma.userCityAccess.findUnique({ where: { userId_cityId: { userId: user.userId, cityId: city.id } } });
    if (!acceso) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const buffer = await armarPlantilla(await idsDeTrabajo(user, city));
  const nombre = `Plantilla de fechas - ${city.name}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "no-store",
    },
  });
}
