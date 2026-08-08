import { Fragment } from "react";
import Link from "next/link";
import type { AggregateEquipoRow } from "@/lib/aggregate-listings";
import { tipoEquipoLabels, criticidadEquipoLabels, criticidadEquipoStyles, type TipoEquipo, type CriticidadEquipo } from "@/lib/equipo-enums";
import { BADGE_STYLES, SECTION_STYLES, equipoColorKey } from "@/lib/section-colors";

// Mismo orden fijo que EquipoTable.tsx.
const TIPOS: TipoEquipo[] = ["MECANICO", "ELECTRICO", "AUXILIAR"];

function porNombre(a: AggregateEquipoRow, b: AggregateEquipoRow): number {
  return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
}

function EquipoRow({ equipo }: { equipo: AggregateEquipoRow }) {
  const colorKey = equipoColorKey(equipo.tipoEquipo);
  return (
    <tr
      className={`relative border-t border-gray-100 hover:bg-gray-50 ${!equipo.activo ? "bg-orange-50" : ""}`}
    >
      <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
        <Link
          href={`/ciudades/${equipo.citySlug}/equipo/${equipo.id}`}
          className="absolute inset-0"
          aria-label={equipo.codigo || equipo.nombre}
        />
        <Link href={`/ciudades/${equipo.citySlug}/equipo/${equipo.id}`} className="relative hover:underline" tabIndex={-1}>
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
      <td className="whitespace-nowrap px-4 py-2 text-ink">{equipo.numeroSerie || "—"}</td>
      <td className="whitespace-nowrap px-4 py-2 text-ink">{equipo.cityName}</td>
      <td className="whitespace-nowrap px-4 py-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[colorKey]}`}>
          {tipoEquipoLabels[equipo.tipoEquipo as TipoEquipo] ?? equipo.tipoEquipo}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-2">
        {equipo.criticidad && (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${criticidadEquipoStyles[equipo.criticidad as CriticidadEquipo]}`}
          >
            {criticidadEquipoLabels[equipo.criticidad as CriticidadEquipo]}
          </span>
        )}
      </td>
    </tr>
  );
}

// Listado combinado de equipos de todas las ciudades reales, solo en
// Administración (ver lib/aggregate-city.ts y lib/aggregate-listings.ts):
// a diferencia de EquipoTable (una sola ciudad), cada fila dice de qué
// ciudad es. Mismo agrupado por tipo (color) y orden alfabético dentro de
// cada grupo que EquipoTable.tsx.
export function AggregateEquipoTable({ equipos }: { equipos: AggregateEquipoRow[] }) {
  if (equipos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay equipos registrados en ninguna ciudad.
      </p>
    );
  }

  const activos = equipos.filter((e) => e.activo);
  const inactivos = [...equipos.filter((e) => !e.activo)].sort(
    (a, b) => a.cityName.localeCompare(b.cityName, "es") || porNombre(a, b)
  );

  const grupos = TIPOS.map((tipo) => ({
    tipo,
    equipos: activos.filter((e) => e.tipoEquipo === tipo).sort(porNombre),
  })).filter((g) => g.equipos.length > 0);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-2">Código</th>
            <th className="whitespace-nowrap px-4 py-2">Nombre</th>
            <th className="whitespace-nowrap px-4 py-2">Número de serie</th>
            <th className="whitespace-nowrap px-4 py-2">Ciudad</th>
            <th className="whitespace-nowrap px-4 py-2">Tipo</th>
            <th className="whitespace-nowrap px-4 py-2">Criticidad</th>
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <Fragment key={grupo.tipo}>
              <tr aria-hidden="true">
                <td colSpan={6} className={`border-t-4 border-gray-200 px-4 py-2 ${SECTION_STYLES[equipoColorKey(grupo.tipo)]}`}>
                  <span className="text-xs font-semibold uppercase text-ink">
                    {tipoEquipoLabels[grupo.tipo]} · {grupo.equipos.length}
                  </span>
                </td>
              </tr>
              {grupo.equipos.map((equipo) => (
                <EquipoRow key={equipo.id} equipo={equipo} />
              ))}
            </Fragment>
          ))}

          {inactivos.length > 0 && (
            <>
              <tr aria-hidden="true">
                <td colSpan={6} className="border-t-4 border-gray-200 bg-gray-100 px-4 py-3">
                  <span className="text-xs font-semibold uppercase text-gray-500">Dados de baja</span>
                </td>
              </tr>
              {inactivos.map((equipo) => (
                <EquipoRow key={equipo.id} equipo={equipo} />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
