import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAccessibleCities } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const cities = await getAccessibleCities(user);

  const q = (searchParams.q ?? "").trim();

  const records = q
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
            { technicalSheet: { serieTanque: { contains: q } } },
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
        include: { section: { include: { city: true, parent: true } } },
        orderBy: { numeroEconomico: "asc" },
        take: 50,
      })
    : [];

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
              </tr>
            </thead>
            <tbody>
              {records.map((record) => {
                const location = [
                  record.section.city.name,
                  record.section.parent?.name,
                  record.section.name,
                ]
                  .filter(Boolean)
                  .join(" / ");
                return (
                  <tr key={record.id} className="border-t border-gray-100 hover:bg-gray-50">
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
