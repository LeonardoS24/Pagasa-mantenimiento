import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idsDeTrabajo } from "@/lib/ciudades-de-trabajo";
import { MESES, getProgramaAnual } from "@/lib/programa-anual";
import { XLSX, escribirLibro, hojaConFormato } from "@/lib/excel-formato";

// El programa anual en Excel: una fila por unidad y actividad, una columna
// por mes con P (programado) y/o R (realizado).
export async function GET(request: NextRequest, { params }: { params: { citySlug: string } }) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const city = await prisma.city.findUnique({ where: { slug: params.citySlug } });
  if (!city) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const user = { userId: session.userId, username: session.username, role: session.role };
  if (user.role !== "ADMIN") {
    const acceso = await prisma.userCityAccess.findUnique({ where: { userId_cityId: { userId: user.userId, cityId: city.id } } });
    if (!acceso) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }
  const sp = request.nextUrl.searchParams;
  const actual = new Date().getFullYear();
  // Mismo límite que la página: un año absurdo daría una fecha inválida.
  const anio = Math.min(actual + 10, Math.max(2000, Math.trunc(Number(sp.get("anio"))) || actual));
  const { filas } = await getProgramaAnual(await idsDeTrabajo(user, city), anio, sp.get("apartado") || undefined);
  const encabezados = ["Ciudad", "Número económico", "Apartado", "Actividad", "Detalle", ...MESES];
  const datos = filas.map((f) => {
    const fila: Record<string, string> = {
      Ciudad: f.cityName,
      "Número económico": f.numeroEconomico,
      Apartado: f.sectionName,
      Actividad: f.actividad,
      Detalle: f.detalle ?? "",
    };
    MESES.forEach((m, i) => (fila[m] = f.meses[i].join(" ")));
    return fila;
  });
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hojaConFormato(datos, encabezados), `Programa ${anio}`);
  const buffer = escribirLibro(libro);
  const nombre = `Programa anual ${anio} - ${city.name}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "no-store",
    },
  });
}
