import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { isAggregateCitySlug, getAllRealCityIds } from "@/lib/aggregate-city";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { leerItemsLote } from "@/lib/lote-documentos";
import { lectorConfigurado } from "@/lib/lector-documentos-ia";
import { DocumentoDeLoteForm, type UnidadParaLote } from "@/components/carga/DocumentoDeLoteForm";
import { AgregarDocumentosForm } from "@/components/carga/AgregarDocumentosForm";
import { EliminarLoteForm } from "@/components/carga/EliminarLoteForm";
import { ActualizarMientrasAnaliza } from "@/components/carga/ActualizarMientrasAnaliza";
import { ReintentarLecturaButton } from "@/components/carga/ReintentarLecturaButton";

// Revisión de un lote: cada documento que se detectó (o se agregó a mano)
// con sus páginas a la vista y sus recuadros ya llenos, para corregir y
// guardarlo en la bitácora de su unidad.
export default async function LoteDocumentosPage({ params }: { params: { citySlug: string; loteId: string } }) {
  const user = await requireUser();
  const city = await assertCityAccess(user, params.citySlug);
  if (!canEdit(user.role)) notFound();

  const lote = await prisma.loteDocumentos.findUnique({
    where: { id: params.loteId },
    include: { createdBy: { select: { username: true } } },
  });
  if (!lote || lote.cityId !== city.id) notFound();

  const esAgregada = isAggregateCitySlug(city.slug);
  const registros = await prisma.vehicleRecord.findMany({
    where: { section: { cityId: { in: esAgregada ? await getAllRealCityIds() : [city.id] } } },
    select: {
      id: true,
      numeroEconomico: true,
      activo: true,
      section: { select: { name: true, slug: true, city: { select: { name: true, slug: true } } } },
      stationTankTechnicalSheets: { select: { id: true, etiqueta: true }, orderBy: { etiqueta: "asc" } },
    },
    orderBy: [{ section: { name: "asc" } }, { numeroEconomico: "asc" }],
  });
  const unidades: UnidadParaLote[] = registros.map((r) => ({
    id: r.id,
    etiqueta: esAgregada ? `${r.numeroEconomico} — ${r.section.city.name}` : r.numeroEconomico,
    apartado: r.section.name,
    sectionSlug: r.section.slug,
    activo: r.activo,
    tanques: r.stationTankTechnicalSheets,
    href: `/ciudades/${r.section.city.slug}/vehiculo/${r.id}`,
  }));

  const items = leerItemsLote(lote.documentos);
  const analizando = lote.estado === "ANALIZANDO";
  const atorado = analizando && Date.now() - lote.updatedAt.getTime() > 10 * 60 * 1000;
  const pendientes = items.filter((i) => i.estado === "PENDIENTE").length;
  const srcEscaneo = `/api/lotes-documentos/${lote.id}`;
  // Para que el formulario de rangos arranque en la primera página que
  // todavía no tiene documento.
  const siguientePagina = items.reduce((max, i) => Math.max(max, i.paginaFin), 0) + 1;
  const puedeEliminarse = !analizando && !items.some((i) => i.estado === "GUARDADO");

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Inicio", href: "/dashboard" },
          { label: city.name, href: `/ciudades/${city.slug}` },
          { label: "Carga de documentos escaneados", href: `/ciudades/${city.slug}/carga-de-documentos` },
          { label: lote.fileName },
        ]}
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-primary">{lote.fileName}</h1>
          <p className="mt-1 text-sm text-ink">
            {lote.paginas} páginas · subido el {lote.createdAt.toLocaleString("es-MX")}
            {lote.createdBy ? ` por ${lote.createdBy.username}` : ""}
            {lote.tokensEntrada != null && (
              <span className="text-gray-500">
                {" "}
                · lectura IA: {lote.tokensEntrada.toLocaleString("es-MX")} tokens de entrada,{" "}
                {(lote.tokensSalida ?? 0).toLocaleString("es-MX")} de salida
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <a
            href={srcEscaneo}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/5"
          >
            Ver escaneo completo ↗
          </a>
          {puedeEliminarse && <EliminarLoteForm loteId={lote.id} />}
        </div>
      </div>

      {analizando && !atorado && (
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 p-5 text-sm text-ink">
          <ActualizarMientrasAnaliza />
          <p className="font-medium text-primary">La IA está leyendo el escaneo…</p>
          <p className="mt-1">
            Puede tardar unos minutos según el número de páginas. Esta página se actualiza sola; también puedes salir y
            volver después.
          </p>
        </div>
      )}
      {(lote.estado === "ERROR" || atorado) && (
        <div className="mb-6 space-y-3 rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          <p>{lote.error ?? "La lectura no terminó (probablemente se reinició el servidor)."}</p>
          <p className="text-ink">Puedes volver a intentarlo o dividir el escaneo a mano con “Agregar documentos por rango de páginas”.</p>
          {lectorConfigurado() && <ReintentarLecturaButton loteId={lote.id} />}
        </div>
      )}
      {lote.notasLector && !analizando && (
        <p className="mb-6 rounded-lg border border-gray-200 bg-white p-4 text-sm text-ink">
          <span className="font-medium">Notas de la IA:</span> {lote.notasLector}
        </p>
      )}
      {!analizando && items.length > 0 && (
        <p className="mb-4 text-sm text-ink">
          {pendientes === 0
            ? "Todos los documentos de este lote ya se guardaron o descartaron."
            : `${pendientes} de ${items.length} documentos por revisar. Revisa que la unidad, las páginas y las fechas coincidan con el escaneo antes de guardar.`}
        </p>
      )}

      <div className="space-y-4">
        {items.map((item, i) => (
          <DocumentoDeLoteForm
            key={item.id}
            loteId={lote.id}
            item={item}
            numero={i + 1}
            unidades={unidades}
            paginasTotal={lote.paginas}
            srcEscaneo={srcEscaneo}
            bloqueado={analizando}
          />
        ))}
        {!analizando && (
          <AgregarDocumentosForm
            loteId={lote.id}
            paginasTotal={lote.paginas}
            siguientePagina={siguientePagina}
            unidades={unidades}
            abierto={items.length === 0}
          />
        )}
      </div>
    </div>
  );
}
