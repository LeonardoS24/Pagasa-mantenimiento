import Link from "next/link";
import type { EquipmentLogEvent } from "@/lib/city-equipment-log-feed";
import { BADGE_STYLES } from "@/lib/section-colors";
import { formatDate } from "@/lib/dates";

export function CityEquipmentLogFeed({ logs, citySlug }: { logs: EquipmentLogEvent[]; citySlug: string }) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-ink">
        <p className="text-lg font-medium text-primary">Sin mantenimientos registrados</p>
        <p className="mt-1 text-sm">
          Los mantenimientos que registres en cada equipo aparecerán aquí, ordenados por fecha.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="text-sm text-ink">
            <span className="font-medium text-primary">{formatDate(log.fecha)}</span>
            {" · "}
            <Link href={`/ciudades/${citySlug}/equipo/${log.equipoId}`} className="font-medium text-primary hover:underline">
              {log.nombreEquipo}
            </Link>
            {" — "}
            {log.detalle}
          </div>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STYLES[log.colorKey]}`}>
            {log.tipo}
          </span>
        </li>
      ))}
    </ul>
  );
}
