import Link from "next/link";
import type { AggregateVehicleRow } from "@/lib/aggregate-listings";

// Listado combinado de unidades de todas las ciudades reales, solo en
// Administración (ver lib/aggregate-city.ts y lib/aggregate-listings.ts):
// a diferencia de VehicleTable (una sola ciudad), cada fila dice de qué
// ciudad es.
export function AggregateVehicleTable({ records }: { records: AggregateVehicleRow[] }) {
  if (records.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay unidades registradas en ninguna ciudad para este apartado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-2">Número económico</th>
            <th className="whitespace-nowrap px-4 py-2">Ciudad</th>
            <th className="whitespace-nowrap px-4 py-2">Sucursal</th>
            <th className="whitespace-nowrap px-4 py-2">Año</th>
            <th className="whitespace-nowrap px-4 py-2">Placas</th>
            <th className="whitespace-nowrap px-4 py-2">Número de serie</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.id}
              className={`relative border-t border-gray-100 hover:bg-gray-50 ${
                !record.activo ? "bg-orange-50" : ""
              }`}
            >
              <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
                {/* Estira el link a toda la fila (no solo esta celda), mismo
                    truco que VehicleTable.tsx. */}
                <Link
                  href={`/ciudades/${record.citySlug}/vehiculo/${record.id}`}
                  className="absolute inset-0"
                  aria-label={record.numeroEconomico}
                />
                <Link
                  href={`/ciudades/${record.citySlug}/vehiculo/${record.id}`}
                  className="relative hover:underline"
                  tabIndex={-1}
                >
                  {record.numeroEconomico}
                </Link>
                {!record.activo && (
                  <span className="ml-2 rounded-full border border-orange-400 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                    Dado de baja
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-ink">{record.cityName}</td>
              <td className="whitespace-nowrap px-4 py-2 text-ink">{record.sucursal}</td>
              <td className="whitespace-nowrap px-4 py-2 text-ink">{record.anio}</td>
              <td className="whitespace-nowrap px-4 py-2 text-ink">{record.placas}</td>
              <td className="whitespace-nowrap px-4 py-2 text-ink">{record.serie || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
