import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { verRecordLabel } from "@/lib/section-labels";
import type { YearlySummaryItem, YearlySummaryCompletedItem } from "@/lib/yearly-change-summary";

// Vista compartida por las 8 pestañas de tipo en Admin > Resumen: la lista
// de lo que vence este año (o ya venció) arriba, y debajo lo que ya se
// registró este año, marcado en verde para que se note que ya no hace falta
// atenderlo (ver getYearlySummary en lib/yearly-change-summary.ts).
export function YearlyDueList({
  typeLabel,
  anchor,
  due,
  completed,
}: {
  typeLabel: string;
  anchor: string;
  due: YearlySummaryItem[];
  completed: YearlySummaryCompletedItem[];
}) {
  const today = new Date();

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-bright">
          {typeLabel} — vencen este año
        </h2>
        {due.length === 0 ? (
          <p className="text-sm text-ink">Ninguna unidad tiene {typeLabel.toLowerCase()} pendiente este año.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {due.map((item, i) => {
              const overdue = item.dueDate ? item.dueDate.getTime() < today.getTime() : false;
              return (
                // Una estación con dos tanques (ver lib/station-valves.ts)
                // puede repetir el mismo id dos veces, una por tanque — el
                // índice desempata la key sin afectar el link, que sí debe
                // seguir usando el id real de la unidad.
                <li key={`${item.id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm text-ink">
                    <span className="font-medium text-primary">{item.numeroEconomico}</span>{" "}
                    <span className="text-gray-500">({item.cityName})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        overdue
                          ? "bg-red-600 text-white border border-red-700 font-bold"
                          : "bg-yellow-100 text-yellow-800 border border-yellow-300"
                      }`}
                    >
                      {overdue ? "Vencido" : "Vence"} {item.dueDate ? formatDate(item.dueDate) : ""}
                    </span>
                    <Link
                      href={`/ciudades/${item.citySlug}/vehiculo/${item.id}#${anchor}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {verRecordLabel(item.sectionSlug)} →
                    </Link>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {completed.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-green-50/40 p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-green-700">
            Ya registrado este año
          </h2>
          <ul className="divide-y divide-green-100">
            {completed.map((item, i) => (
              <li key={`${item.id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm text-ink">
                  <span className="font-medium text-primary">{item.numeroEconomico}</span>{" "}
                  <span className="text-gray-500">({item.cityName})</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                    ✓ Registrado {formatDate(item.fechaRegistro)}
                  </span>
                  <Link
                    href={`/ciudades/${item.citySlug}/vehiculo/${item.id}#${anchor}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {verRecordLabel(item.sectionSlug)} →
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
