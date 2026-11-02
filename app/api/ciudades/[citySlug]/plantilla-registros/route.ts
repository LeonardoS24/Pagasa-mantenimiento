import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idsDeTrabajo } from "@/lib/ciudades-de-trabajo";
import { armarPlantillaRegistros } from "@/lib/registros-excel-servidor";

// Plantilla de Excel para registrar de un jalón registros NUEVOS de bitácora
// (una hoja por tipo, con las unidades de la ciudad ya puestas); se sube en
// «Registros desde Excel» (ver lib/registros-excel.ts).
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
  const buffer = await armarPlantillaRegistros(await idsDeTrabajo(user, city));
  const nombre = `Plantilla de registros - ${city.name}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "no-store",
    },
  });
}
