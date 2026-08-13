import type { ExtinguisherQualityChangeLog } from "@prisma/client";
import { calidadExtintorLabels, type CalidadExtintor } from "@/lib/vehicle-enums";
import { formatDate } from "@/lib/dates";

type LogWithCreator = ExtinguisherQualityChangeLog & { createdBy: { username: string } | null };

const badgeStyles: Record<string, string> = {
  EXCELENTE: "bg-green-100 text-green-700",
  BUENA: "bg-yellow-100 text-yellow-800",
  MALA: "bg-red-100 text-red-700",
};

function label(value: string | null): string {
  return value ? (calidadExtintorLabels[value as CalidadExtintor] ?? value) : "Sin dato";
}

// Historial de cambios de estado del extintor (antes/después), separado del
// listado de "Cambio de extintor" (ExtinguisherChangeLogTable): ese es el
// registro de cuándo se instaló un extintor físico nuevo, este es cuándo
// cambió la calidad reportada y por qué (ver ExtinguisherQualityChangeLog en
// el schema y updateCalidadExtintor en actions/vehicle-actions.ts).
export function ExtinguisherQualityHistory({ logs }: { logs: LogWithCreator[] }) {
  if (logs.length === 0) return null;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
        Historial de cambios de estado
      </p>
      <ul className="divide-y divide-gray-100">
        {logs.map((log) => (
          <li key={log.id} className="flex flex-col gap-1 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyles[log.calidadAnterior ?? ""] ?? "bg-gray-100 text-gray-600"}`}>
                {label(log.calidadAnterior)}
              </span>
              <span className="text-gray-400">→</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyles[log.calidadNueva] ?? "bg-gray-100 text-gray-600"}`}>
                {label(log.calidadNueva)}
              </span>
              <span className="text-xs text-gray-500">
                {formatDate(log.createdAt)} · {log.createdBy?.username ?? "Desconocido"}
              </span>
            </div>
            {log.observacion && <p className="text-xs text-ink">{log.observacion}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
