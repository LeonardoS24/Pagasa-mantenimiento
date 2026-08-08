import Link from "next/link";
import type { AggregateEquipoRow } from "@/lib/aggregate-listings";
import { tipoEquipoLabels, type TipoEquipo } from "@/lib/equipo-enums";
import { BADGE_STYLES, equipoColorKey } from "@/lib/section-colors";

// Equipos de criticidad ALTA de todas las ciudades, aunque todavía no
// tengan ningún mantenimiento en su bitácora (a diferencia de
// CityEquipmentLogFeed, que solo lista eventos ya registrados): para que un
// equipo crítico nunca pase desapercibido en Administración solo por no
// haber recibido mantenimiento todavía.
export function HighCriticidadEquiposPanel({ equipos }: { equipos: AggregateEquipoRow[] }) {
  if (equipos.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-red-600">
        Equipos de criticidad alta
      </h2>
      <p className="mb-3 text-xs text-gray-500">
        Todos los equipos activos marcados como criticidad Alta, tengan o no mantenimiento registrado.
      </p>
      <ul className="space-y-2">
        {equipos.map((equipo) => {
          const colorKey = equipoColorKey(equipo.tipoEquipo);
          return (
            <li
              key={equipo.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-red-50 px-3 py-2 text-sm"
            >
              <span className="text-ink">
                <Link
                  href={`/ciudades/${equipo.citySlug}/equipo/${equipo.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {equipo.nombre}
                </Link>
                {" "}
                <span className="text-gray-500">({equipo.cityName})</span>
              </span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[colorKey]}`}>
                {tipoEquipoLabels[equipo.tipoEquipo as TipoEquipo] ?? equipo.tipoEquipo}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
