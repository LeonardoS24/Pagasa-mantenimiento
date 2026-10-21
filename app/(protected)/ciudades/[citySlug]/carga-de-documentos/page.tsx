import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { canEdit } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SubirLoteForm } from "@/components/carga/SubirLoteForm";
import { lectorConfigurado } from "@/lib/lector-documentos-ia";
import { leerItemsLote, estadoLoteLabel } from "@/lib/lote-documentos";

// Carga de documentos escaneados: se sube un PDF con varios documentos
// juntos y cada uno termina en la bitácora de su unidad (ver
// actions/lote-documentos-actions.ts). Solo para quien puede capturar.
export default async function CargaDeDocumentosPage({ params }: { params: { citySlug: string } }) {
  const user = await requireUser();
  const city = await assertCityAccess(user, params.citySlug);
  const migas = [
    { label: "Inicio", href: "/dashboard" },
    { label: city.name, href: `/ciudades/${city.slug}` },
    { label: "Carga de documentos escaneados" },
  ];

  if (!canEdit(user.role)) {
    return (
      <div>
        <Breadcrumb items={migas} />
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-ink">
          Solo los usuarios que capturan información pueden cargar documentos.
        </p>
      </div>
    );
  }

  const lotes = await prisma.loteDocumentos.findMany({
    where: { cityId: city.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { createdBy: { select: { username: true } } },
  });

  return (
    <div>
      <Breadcrumb items={migas} />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">Carga de documentos escaneados</h1>
        <p className="mt-1 text-sm text-ink">
          Sube en un solo PDF las pruebas, inspecciones, dictámenes, pólizas o mantenimientos que se escanearon juntos.
          Cada documento se guarda en la bitácora de su unidad con solo sus páginas.
        </p>
      </div>

      <SubirLoteForm citySlug={city.slug} conIA={lectorConfigurado()} />

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase text-primary-bright">Lotes subidos</h2>
      {lotes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
          Todavía no se ha subido ningún lote en {city.name}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
              <tr>
                <th className="px-4 py-2">Archivo</th>
                <th className="px-4 py-2">Subido</th>
                <th className="px-4 py-2">Páginas</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Documentos</th>
              </tr>
            </thead>
            <tbody>
              {lotes.map((lote) => {
                const items = leerItemsLote(lote.documentos);
                const pendientes = items.filter((i) => i.estado === "PENDIENTE").length;
                const guardados = items.filter((i) => i.estado === "GUARDADO").length;
                const estado =
                  lote.estado === "POR_REVISAR" && items.length > 0 && pendientes === 0
                    ? "Terminado"
                    : estadoLoteLabel[lote.estado] ?? lote.estado;
                return (
                  <tr key={lote.id} className="border-t border-gray-100">
                    <td className="px-4 py-2">
                      <Link href={`/ciudades/${city.slug}/carga-de-documentos/${lote.id}`} className="text-primary hover:underline">
                        {lote.fileName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-600">
                      {lote.createdAt.toLocaleString("es-MX")}
                      {lote.createdBy ? ` · ${lote.createdBy.username}` : ""}
                    </td>
                    <td className="px-4 py-2">{lote.paginas}</td>
                    <td className="px-4 py-2">{estado}</td>
                    <td className="px-4 py-2 text-gray-600">
                      {items.length === 0 ? "—" : `${guardados} guardados · ${pendientes} pendientes`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
