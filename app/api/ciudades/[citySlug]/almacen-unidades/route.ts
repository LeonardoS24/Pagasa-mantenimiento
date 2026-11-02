import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { CIUDADES_ALMACEN } from "@/lib/almacen";
import { unidadesDelSistema } from "@/lib/almacen-servidor";

// Lista de todas las unidades, estaciones y plantas del sistema, una por
// renglón, para pegarla en la pestaña «Listas» de la hoja de Google y que
// «Unidad / Estación» se pueda elegir de una lista desplegable.
export async function GET(_req: Request, { params }: { params: { citySlug: string } }) {
  const user = await requireUser();
  await assertCityAccess(user, params.citySlug);
  if (!CIUDADES_ALMACEN.includes(params.citySlug)) return new NextResponse("No disponible en esta ciudad.", { status: 404 });
  const unidades = await unidadesDelSistema();
  const csv = "﻿" + ["Unidades y estaciones", ...unidades.map((u) => `"${u.etiqueta.replace(/"/g, '""')}"`)].join("\r\n") + "\r\n";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="unidades-y-estaciones.csv"',
      "Cache-Control": "no-store",
    },
  });
}
