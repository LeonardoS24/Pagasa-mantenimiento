import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getRegistrosAcceso, leerFiltros } from "@/lib/bitacora-acceso";
import { EVENTOS_ACCESO, type EventoAcceso } from "@/lib/registro-acceso";
import { XLSX, escribirLibro, hojaConFormato } from "@/lib/excel-formato";

// La bitácora de acceso en Excel, con los mismos filtros que la pantalla.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  if (session.role !== "ADMIN") return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const filtros = leerFiltros(Object.fromEntries(request.nextUrl.searchParams));
  const { registros } = await getRegistrosAcceso(filtros, 1, 50_000);
  const encabezados = ["Fecha", "Hora", "Evento", "Usuario", "Detalle", "Hecho por", "IP", "Navegador"];
  const filas = registros.map((r) => ({
    Fecha: r.createdAt.toLocaleDateString("es-MX"),
    Hora: r.createdAt.toLocaleTimeString("es-MX"),
    Evento: EVENTOS_ACCESO[r.evento as EventoAcceso] ?? r.evento,
    Usuario: r.username,
    Detalle: r.detalle ?? "",
    "Hecho por": r.actorUsername ?? "",
    IP: r.ip ?? "",
    Navegador: r.navegador ?? "",
  }));
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hojaConFormato(filas, encabezados), "Bitácora de acceso");
  const buffer = escribirLibro(libro);
  const nombre = `Bitacora de acceso ${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
