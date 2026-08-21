import Link from "next/link";
import type { DecommissionedEquipoRow } from "@/lib/decommissioned-equipos";
import { tipoEquipoLabels, type TipoEquipo } from "@/lib/equipo-enums";
import { BADGE_STYLES, equipoColorKey } from "@/lib/section-colors";
import { formatDate } from "@/lib/dates";

// Lista de equipos ya fuera de servicio (dados de baja directo, o
// reemplazados con un mantenimiento tipo "Cambio"/"Reemplazo" — ver
// lib/decommissioned-equipos.ts) para la Bitácora de equipos: antes esta
// vista solo mostraba el feed de mantenimientos, sin rastro de qué equipos
// ya no están en servicio ni por cuál se sustituyeron.
export function DecommissionedEquiposPanel({
  equipos,
  showCity = false,
}: {
  equipos: DecommissionedEquipoRow[];
  showCity?: boolean;
}) {
  if (equipos.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">Equipos dados de baja</h3>
        <p className="mt-2 text-sm text-ink">Todavía no hay equipos dados de baja.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">Equipos dados de baja</h3>
        <p className="text-xs text-gray-500">Reemplazados o retirados, con el equipo que los sustituyó cuando aplica.</p>
      </div>
      <ul className="divide-y divide-gray-200">
        {equipos.map((equipo) => {
          const colorKey = equipoColorKey(equipo.tipoEquipo);
          return (
            <li key={equipo.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="text-ink">
                <Link
                  href={`/ciudades/${equipo.citySlug}/equipo/${equipo.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {equipo.codigo || equipo.nombre}
                </Link>
                {equipo.estacionNombre ? ` (${equipo.estacionNombre})` : ""}
                {showCity ? ` — ${equipo.cityName}` : ""}
                {equipo.fechaBaja && (
                  <span className="text-gray-500"> · dado de baja el {formatDate(equipo.fechaBaja)}</span>
                )}
                {equipo.motivoBaja && <span className="text-gray-500"> · {equipo.motivoBaja}</span>}
                {equipo.sustituidoPorId && (
                  <span className="text-gray-500">
                    {" "}
                    · sustituido por{" "}
                    <Link
                      href={`/ciudades/${equipo.citySlug}/equipo/${equipo.sustituidoPorId}`}
                      className="text-primary hover:underline"
                    >
                      {equipo.sustituidoPorNombre}
                    </Link>
                  </span>
                )}
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[colorKey]}`}>
                {tipoEquipoLabels[equipo.tipoEquipo as TipoEquipo] ?? equipo.tipoEquipo}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
