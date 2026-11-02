import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { idsDeTrabajo } from "@/lib/ciudades-de-trabajo";
import { getExpediente, type EstadoRequisito } from "@/lib/expediente";
import { XLSX, escribirLibro, hojaConFormato } from "@/lib/excel-formato";

const ESTADO: Record<EstadoRequisito, string> = { vencido: "Vencido", porVencer: "Por vencer", sinDato: "Sin dato", vigente: "Vigente" };
const f = (d: Date | null) => (d ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : "");

// El expediente de cumplimiento en Excel, con los mismos filtros que la página.
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
  const unidades = await getExpediente(await idsDeTrabajo(user, city), {
    apartado: sp.get("apartado") || undefined,
    unidad: sp.get("unidad") || undefined,
  });
  const encabezados = ["Ciudad", "Número económico", "Apartado", "Requisito", "Detalle", "Fundamento", "Vence", "Estado", "Último registro", "Documentos"];
  const filas = unidades.flatMap((u) =>
    u.elementos.map((e) => ({
      Ciudad: u.cityName,
      "Número económico": u.numeroEconomico,
      Apartado: u.sectionName,
      Requisito: e.requisito,
      Detalle: e.detalle ?? "",
      Fundamento: e.fundamento,
      Vence: f(e.vence),
      Estado: ESTADO[e.estado],
      "Último registro": f(e.ultimoRegistro),
      Documentos: String(e.documentos),
    }))
  );
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hojaConFormato(filas, encabezados), "Expediente");
  const buffer = escribirLibro(libro);
  const nombre = `Expediente de cumplimiento - ${city.name}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre.replace(/[^\x20-\x7E]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "no-store",
    },
  });
}
