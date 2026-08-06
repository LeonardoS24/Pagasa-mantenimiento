import { Fragment } from "react";
import Link from "next/link";
import type { Equipo } from "@prisma/client";
import { tipoEquipoLabels, estadoEquipoLabels, estadoEquipoStyles, criticidadEquipoLabels, criticidadEquipoStyles, type EstadoEquipo, type CriticidadEquipo, type TipoEquipo } from "@/lib/equipo-enums";
import { BADGE_STYLES, equipoColorKey } from "@/lib/section-colors";

export function EquipoTable({ equipos, citySlug }: { equipos: Equipo[]; citySlug: string }) {
  if (equipos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay equipos registrados en este apartado.
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
            <th className="whitespace-nowrap px-4 py-2">Tipo</th>
            <th className="whitespace-nowrap px-4 py-2">Estado</th>
            <th className="whitespace-nowrap px-4 py-2">Criticidad</th>
          </tr>
        </thead>
        <tbody>
          {equipos.map((equipo, index) => {
            const colorKey = equipoColorKey(equipo.tipoEquipo);
            const estado = equipo.estado as EstadoEquipo | null;
            const criticidad = equipo.criticidad as CriticidadEquipo | null;
            const isFirstInactive = !equipo.activo && (index === 0 || equipos[index - 1].activo);
            return (
              <Fragment key={equipo.id}>
                {isFirstInactive && (
                  <tr aria-hidden="true">
                    <td colSpan={5} className="border-t-4 border-gray-200 bg-gray-100 px-4 py-3">
                      <span className="text-xs font-semibold uppercase text-gray-500">Dados de baja</span>
                    </td>
                  </tr>
                )}
                <tr
                  className={`relative border-t border-gray-100 hover:bg-gray-50 ${
                    !equipo.activo ? "bg-orange-50" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
                    <Link
                      href={`/ciudades/${citySlug}/equipo/${equipo.id}`}
                      className="absolute inset-0"
                      aria-label={equipo.codigo || equipo.nombre}
                    />
                    <Link
                      href={`/ciudades/${citySlug}/equipo/${equipo.id}`}
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
                  <td className="whitespace-nowrap px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[colorKey]}`}>
                      {tipoEquipoLabels[equipo.tipoEquipo as TipoEquipo] ?? equipo.tipoEquipo}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {estado && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estadoEquipoStyles[estado]}`}>
                        {estadoEquipoLabels[estado]}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2">
                    {criticidad && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${criticidadEquipoStyles[criticidad]}`}>
                        {criticidadEquipoLabels[criticidad]}
                      </span>
                    )}
                  </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
