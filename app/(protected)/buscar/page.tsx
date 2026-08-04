import { Fragment } from "react";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAccessibleCities } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import type { VehicleRecord, VehicleTechnicalSheet } from "@prisma/client";

type RecordWithSheet = VehicleRecord & {
  technicalSheet: VehicleTechnicalSheet | null;
  section: { name: string; city: { name: string; slug: string }; parent: { name: string } | null };
};

// Cada campo buscable se agrupa por la subsección/recuadro de la ficha
// técnica donde vive (mismos nombres que las tarjetas de color en
// TechnicalSheetForm/TechnicalSheetView), para poder decirle al usuario
// dónde exactamente se encontró su búsqueda.
function computeMatchedGroups(record: RecordWithSheet, q: string): string[] {
  const sheet = record.technicalSheet;
  const matchers: { group: string; value: string | null | undefined }[] = [
    { group: "Datos generales", value: record.numeroEconomico },
    { group: "Datos generales", value: record.placas },
    { group: "Datos generales", value: record.sucursal },
    { group: "Datos generales", value: record.numeroAnterior },
    { group: "Datos generales", value: record.localidadAnterior },
    { group: "Ficha técnica · Automóvil", value: sheet?.fabricante },
    { group: "Ficha técnica · Automóvil", value: sheet?.marca },
    { group: "Ficha técnica · Automóvil", value: sheet?.linea },
    { group: "Ficha técnica · Automóvil", value: sheet?.modelo },
    { group: "Ficha técnica · Automóvil", value: sheet?.peso },
    { group: "Ficha técnica · Automóvil", value: sheet?.pesoBrutoVacio },
    { group: "Ficha técnica · Automóvil", value: sheet?.pesoBrutoMaximo },
    { group: "Ficha técnica · Automóvil", value: sheet?.serie },
    { group: "Ficha técnica · Automóvil", value: sheet?.caracteristicas },
    { group: "Ficha técnica · Automóvil", value: sheet?.horasUsoDiario },
    { group: "Ficha técnica · Tanque", value: sheet?.capacidadTanque },
    { group: "Ficha técnica · Tanque", value: sheet?.marcaTanque },
    { group: "Ficha técnica · Tanque", value: sheet?.anioFabricacionTanque },
    { group: "Ficha técnica · Tanque", value: sheet?.numeroSerieTanque },
    { group: "Ficha técnica · Ultrasonido", value: sheet?.numeroUltimoUltrasonido },
    { group: "Ficha técnica · Inspección Visual Externa", value: sheet?.numeroUltimaInspeccionVisual },
    { group: "Ficha técnica · Prueba de Hermeticidad", value: sheet?.numeroUltimaPruebaHermeticidad },
    { group: "Ficha técnica · Inspección Visual Interna", value: sheet?.numeroUltimaInspeccionVisualInterna },
    { group: "Ficha técnica · Prueba Hidrostática", value: sheet?.numeroUltimaPruebaHidrostatica },
  ];
  // SQLite hace `contains` (LIKE) insensible a mayúsculas por defecto, así
  // que la comparación aquí también debe serlo para reflejar exactamente lo
  // que ya coincidió en la consulta de arriba.
  const qLower = q.toLowerCase();
  const groups = new Set<string>();
  for (const matcher of matchers) {
    if (matcher.value && matcher.value.toLowerCase().includes(qLower)) groups.add(matcher.group);
  }
  return Array.from(groups);
}

// Colapsa espacios repetidos: algunos números económicos importados desde
// Excel traen doble espacio ("KG  138"), lo que haría que una búsqueda
// exacta normal ("KG 138") nunca coincidiera exactamente.
function normalizeForExactMatch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

// Una unidad dada de baja solo se considera "coincidencia específica" (y por
// lo tanto conserva su posición normal en los resultados) cuando la
// búsqueda coincide exactamente con su número económico o placas. Cualquier
// otra coincidencia (general, parcial) la manda hasta el final.
function isSpecificMatch(record: RecordWithSheet, qNormalized: string): boolean {
  return (
    normalizeForExactMatch(record.numeroEconomico) === qNormalized ||
    normalizeForExactMatch(record.placas) === qNormalized
  );
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const cities = await getAccessibleCities(user);

  const q = (searchParams.q ?? "").trim();
  const qNormalized = normalizeForExactMatch(q);

  const rawRecords = q
    ? await prisma.vehicleRecord.findMany({
        where: {
          section: { cityId: { in: cities.map((city) => city.id) } },
          OR: [
            { numeroEconomico: { contains: q } },
            { placas: { contains: q } },
            { sucursal: { contains: q } },
            { numeroAnterior: { contains: q } },
            { localidadAnterior: { contains: q } },
            { technicalSheet: { fabricante: { contains: q } } },
            { technicalSheet: { marca: { contains: q } } },
            { technicalSheet: { linea: { contains: q } } },
            { technicalSheet: { modelo: { contains: q } } },
            { technicalSheet: { peso: { contains: q } } },
            { technicalSheet: { pesoBrutoVacio: { contains: q } } },
            { technicalSheet: { pesoBrutoMaximo: { contains: q } } },
            { technicalSheet: { serie: { contains: q } } },
            { technicalSheet: { caracteristicas: { contains: q } } },
            { technicalSheet: { horasUsoDiario: { contains: q } } },
            { technicalSheet: { capacidadTanque: { contains: q } } },
            { technicalSheet: { marcaTanque: { contains: q } } },
            { technicalSheet: { anioFabricacionTanque: { contains: q } } },
            { technicalSheet: { numeroSerieTanque: { contains: q } } },
            { technicalSheet: { numeroUltimoUltrasonido: { contains: q } } },
            { technicalSheet: { numeroUltimaInspeccionVisual: { contains: q } } },
            { technicalSheet: { numeroUltimaPruebaHermeticidad: { contains: q } } },
            { technicalSheet: { numeroUltimaInspeccionVisualInterna: { contains: q } } },
            { technicalSheet: { numeroUltimaPruebaHidrostatica: { contains: q } } },
          ],
        },
        include: { section: { include: { city: true, parent: true } }, technicalSheet: true },
        orderBy: { numeroEconomico: "asc" },
        take: 50,
      })
    : [];

  // Las unidades dadas de baja se mandan hasta el final de los resultados,
  // a menos que la búsqueda coincida exactamente con su número económico o
  // placas (en ese caso es justo lo que se estaba buscando, así que se
  // queda en su posición normal).
  const records = [...rawRecords].sort((a, b) => {
    const aPushed = !a.activo && !isSpecificMatch(a, qNormalized);
    const bPushed = !b.activo && !isSpecificMatch(b, qNormalized);
    if (aPushed !== bPushed) return aPushed ? 1 : -1;
    return a.numeroEconomico.localeCompare(b.numeroEconomico);
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-primary">Buscar</h1>
      <p className="mb-6 text-sm text-ink">
        Busca por número económico, placas, sucursal o localidad anterior.
      </p>

      <form action="/buscar" method="GET" className="mb-6 max-w-md">
        <input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Ej. 1234, ABC-123, Hermosillo..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </form>

      {!q && <p className="text-sm text-gray-500">Escribe un término para comenzar a buscar.</p>}

      {q && records.length === 0 && (
        <p className="text-sm text-gray-500">
          No se encontraron resultados para <span className="font-medium text-ink">"{q}"</span>.
        </p>
      )}

      {records.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-2">Número económico</th>
                <th className="whitespace-nowrap px-4 py-2">Placas</th>
                <th className="whitespace-nowrap px-4 py-2">Sucursal</th>
                <th className="whitespace-nowrap px-4 py-2">Ubicación</th>
                <th className="whitespace-nowrap px-4 py-2">Coincide en</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, index) => {
                const location = [
                  record.section.city.name,
                  record.section.parent?.name,
                  record.section.name,
                ]
                  .filter(Boolean)
                  .join(" / ");
                const matchedGroups = computeMatchedGroups(record, q);
                const isPushedDown = !record.activo && !isSpecificMatch(record, qNormalized);
                const isFirstPushedDown =
                  isPushedDown &&
                  (index === 0 ||
                    records[index - 1].activo ||
                    isSpecificMatch(records[index - 1], qNormalized));
                return (
                  <Fragment key={record.id}>
                    {isFirstPushedDown && (
                      <tr aria-hidden="true">
                        <td colSpan={5} className="border-t-4 border-gray-200 bg-gray-100 px-4 py-3">
                          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Dadas de baja
                          </span>
                        </td>
                      </tr>
                    )}
                    <tr className="border-t border-gray-100 hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
                        <Link
                          href={`/ciudades/${record.section.city.slug}/vehiculo/${record.id}`}
                          className="hover:underline"
                        >
                          {record.numeroEconomico}
                        </Link>
                        {!record.activo && (
                          <span className="ml-2 rounded-full border border-orange-400 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                            Dado de baja
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-ink">{record.placas}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-ink">{record.sucursal}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-ink">{location}</td>
                      <td className="px-4 py-2 text-ink">
                        <div className="flex flex-wrap gap-1">
                          {matchedGroups.map((group) => (
                            <span
                              key={group}
                              className="whitespace-nowrap rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                            >
                              {group}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
