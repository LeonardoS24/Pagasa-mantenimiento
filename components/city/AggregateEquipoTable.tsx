import Link from "next/link";
import type { AggregateEquipoRow } from "@/lib/aggregate-listings";
import { tipoEquipoLabels, type TipoEquipo } from "@/lib/equipo-enums";
import { BADGE_STYLES, equipoColorKey } from "@/lib/section-colors";

// Listado combinado de equipos de todas las ciudades reales, solo en
// Administración (ver lib/aggregate-city.ts y lib/aggregate-listings.ts):
// a diferencia de EquipoTable (una sola ciudad), cada fila dice de qué
// ciudad es.
export function AggregateEquipoTable({ equipos }: { equipos: AggregateEquipoRow[] }) {
  if (equipos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay equipos registrados en ninguna ciudad.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-2">Código</th>
            <th className="whitespace-nowrap px-4 py-2">Nombre</th>
            <th className="whitespace-nowrap px-4 py-2">Ciudad</th>
            <th className="whitespace-nowrap px-4 py-2">Tipo</th>
          </tr>
        </thead>
        <tbody>
          {equipos.map((equipo) => {
            const colorKey = equipoColorKey(equipo.tipoEquipo);
            return (
              <tr
                key={equipo.id}
                className={`relative border-t border-gray-100 hover:bg-gray-50 ${
                  !equipo.activo ? "bg-orange-50" : ""
                }`}
              >
                <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
                  <Link
                    href={`/ciudades/${equipo.citySlug}/equipo/${equipo.id}`}
                    className="absolute inset-0"
                    aria-label={equipo.codigo || equipo.nombre}
                  />
                  <Link
                    href={`/ciudades/${equipo.citySlug}/equipo/${equipo.id}`}
                    className="relative hover:underline"
                    tabIndex={-1}
                  >
                    {equipo.codigo || "—"}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">
                  {equipo.nombre}
                  {!equipo.activo && (
                    <span className="ml-2 rounded-full border border-orange-400 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                      Dado de baja
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{equipo.cityName}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[colorKey]}`}>
                    {tipoEquipoLabels[equipo.tipoEquipo as TipoEquipo] ?? equipo.tipoEquipo}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
