import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildCityFleetWorkbook,
  buildAllCitiesFleetWorkbook,
  excelFileName,
  type ExcelAmbito,
} from "@/lib/vehicle-excel-export";
import { isAggregateCitySlug } from "@/lib/aggregate-city";

const VALID_AMBITOS: ExcelAmbito[] = ["todo", "unidades", "estaciones", "planta"];

export async function GET(request: NextRequest, { params }: { params: { citySlug: string } }) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const usuario = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, role: true },
  });
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

  const ambitoParam = request.nextUrl.searchParams.get("ambito");
  const ambito: ExcelAmbito = VALID_AMBITOS.includes(ambitoParam as ExcelAmbito)
    ? (ambitoParam as ExcelAmbito)
    : "todo";

  // Administración no tiene unidades/estaciones propias (ver
  // lib/aggregate-city.ts): su descarga junta las de todas las ciudades
  // reales en vez de salir vacía.
  const { buffer, cityName } = isAggregateCitySlug(city.slug)
    ? await buildAllCitiesFleetWorkbook(ambito)
    : await buildCityFleetWorkbook(params.citySlug, ambito);

  const fileName = excelFileName(cityName, ambito);
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, "_");

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Content-Length": String(buffer.length),
    },
  });
}
