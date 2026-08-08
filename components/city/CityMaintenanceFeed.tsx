import Link from "next/link";
import { unitLogEventHref, type UnitLogEvent } from "@/lib/city-unit-log-feed";
import { BADGE_STYLES } from "@/lib/section-colors";
import { formatDate } from "@/lib/dates";

export function CityMaintenanceFeed({
  logs,
  showCity = false,
}: {
  logs: UnitLogEvent[];
  // "Administración" combina el feed de todas las ciudades reales en
  // uno solo (ver lib/aggregate-city.ts); ahí hace falta decir de cuál
  // ciudad es cada registro, ya que el link solo no basta para distinguirlo.
  showCity?: boolean;
}) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-ink">
        <p className="text-lg font-medium text-primary">Sin registros en la bitácora</p>
        <p className="mt-1 text-sm">
          Los mantenimientos, bitácoras y bajas que registres en cada unidad aparecerán aquí, ordenados por fecha.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <li key={log.id} className="hover:bg-gray-50">
          <Link
            href={unitLogEventHref(log)}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
          >
            <span className="text-sm text-ink">
              <span className="font-medium text-primary">{formatDate(log.fecha)}</span>
              {" · "}
              <span className="font-medium text-primary hover:underline">{log.numeroEconomico}</span>
              {showCity && <span className="text-gray-500"> ({log.cityName})</span>}
              {" — "}
              {log.detalle}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[log.colorKey]}`}>
              {log.tipo}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
