"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { RecordTypeStats } from "@/lib/record-count-stats";
import { fetchRecordEntriesForType } from "@/actions/record-drilldown-actions";
import type { UnitLogEvent } from "@/lib/city-unit-log-feed";
import type { MonthRange } from "@/lib/piece-maintenance-stats";
import { formatDate } from "@/lib/dates";

const BAR_HEIGHT = 18;
const BAR_GAP = 10;
const CHART_WIDTH = 560;
const LABEL_WIDTH = 200;
// Ver el mismo comentario en RecordCountByCityChart.tsx: sin este margen, el
// número de la barra con el total más alto queda fuera del viewBox.
const VALUE_WIDTH = 30;

function eventHref(event: UnitLogEvent): string {
  const base = `/ciudades/${event.citySlug}/vehiculo/${event.vehicleRecordId}`;
  if (event.id.startsWith("mantenimiento-")) {
    return `${base}?mantenimiento=${event.id.slice("mantenimiento-".length)}`;
  }
  return base;
}

// Desglose al hacer clic en una barra del ranking general: todas las
// ciudades combinadas (cityId null), a diferencia de RecordCountByCityChart
// (que desglosa una sola ciudad a la vez).
function TypeBreakdown({
  stat,
  range,
  onClose,
}: {
  stat: RecordTypeStats;
  range: MonthRange;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<UnitLogEvent[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setEntries(null);
    startTransition(async () => {
      const data = await fetchRecordEntriesForType(stat.type, null, range);
      setEntries(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stat.type, range]);

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-gray-500">
          Registros: {stat.label} (todas las ciudades)
        </p>
        <button type="button" onClick={onClose} className="text-xs text-primary hover:underline">
          Cerrar
        </button>
      </div>

      {isPending || entries === null ? (
        <p className="text-sm text-ink">Cargando...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink">No se encontraron registros.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {entries.map((event) => (
            <li key={event.id} className="py-1.5 text-sm">
              <Link href={eventHref(event)} className="text-primary hover:underline">
                {formatDate(event.fecha)} · {event.numeroEconomico} ({event.cityName})
              </Link>
              <span className="text-gray-500"> — {event.detalle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Compara los 10 tipos de bitácora de unidad entre sí (ver
// lib/record-count-stats.ts): "stats" ya viene ordenado de mayor a menor
// total, así que el ranking de arriba abajo responde "cuál se hizo más en
// general". La tabla de abajo, con una columna por ciudad, responde "cuál se
// hizo más en cada ciudad" — con 10 tipos y hasta 10 ciudades una tabla es
// mucho más legible que intentar meter 10 colores distinguibles en un solo
// gráfico apilado. Un clic en una barra del ranking desglosa sus registros.
export function RecordTypeComparisonSection({
  stats,
  range,
  monthLabel,
}: {
  stats: RecordTypeStats[];
  range: MonthRange;
  monthLabel: string;
}) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const cities = stats[0]?.byCity ?? [];
  const grandTotal = stats.reduce((sum, s) => sum + s.total, 0);

  if (grandTotal === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">
          Comparativa de todos los registros
        </h3>
        <p className="mt-2 text-sm text-ink">Todavía no hay registros de ningún tipo en {monthLabel}.</p>
      </div>
    );
  }

  const maxTotal = Math.max(...stats.map((s) => s.total));
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - VALUE_WIDTH;
  const svgHeight = stats.length * (BAR_HEIGHT + BAR_GAP);
  const selectedStat = stats.find((s) => s.type === selectedType) ?? null;

  function toggleType(type: string) {
    setSelectedType((current) => (current === type ? null : type));
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">
          Comparativa de todos los registros
        </h3>
        <p className="text-xs text-gray-500">
          {monthLabel} · se reinicia cada mes · haz clic en un tipo para ver sus registros
        </p>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase text-gray-500">En general (todas las ciudades)</p>
      <div className="mb-6 overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${svgHeight}`}
          width="100%"
          height={svgHeight}
          role="img"
          aria-label="Total de registros por tipo, todas las ciudades"
        >
          {stats.map((stat, rowIndex) => {
            const y = rowIndex * (BAR_HEIGHT + BAR_GAP);
            const width = maxTotal > 0 ? (stat.total / maxTotal) * plotWidth : 0;
            return (
              <g key={stat.type} onClick={() => toggleType(stat.type)} className="cursor-pointer">
                <rect
                  x={0}
                  y={y - BAR_GAP / 2}
                  width={CHART_WIDTH}
                  height={BAR_HEIGHT + BAR_GAP}
                  fill={selectedType === stat.type ? "currentColor" : "transparent"}
                  className="text-accent/5"
                />
                <text
                  x={LABEL_WIDTH - 8}
                  y={y + BAR_HEIGHT / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-gray-600"
                  fontSize="11"
                >
                  {stat.label}
                </text>
                <rect
                  x={LABEL_WIDTH}
                  y={y}
                  width={Math.max(width, stat.total > 0 ? 2 : 0)}
                  height={BAR_HEIGHT}
                  rx={3}
                  ry={3}
                  fill={stat.color}
                  opacity={0.9}
                >
                  <title>
                    {stat.label}: {stat.total}
                  </title>
                </rect>
                <text
                  x={LABEL_WIDTH + Math.max(width, 4) + 6}
                  y={y + BAR_HEIGHT / 2}
                  dominantBaseline="middle"
                  className="fill-ink"
                  fontSize="11"
                  fontWeight={600}
                >
                  {stat.total}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedStat && (
        <TypeBreakdown stat={selectedStat} range={range} onClose={() => setSelectedType(null)} />
      )}

      <p className="mb-2 mt-6 text-xs font-semibold uppercase text-gray-500">Por ciudad</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="py-1 pr-3">Tipo de registro</th>
              {cities.map((c) => (
                <th key={c.citySlug} className="whitespace-nowrap py-1 pr-3">
                  {c.cityName}
                </th>
              ))}
              <th className="py-1 pr-3">Total</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((stat) => (
              <tr key={stat.type} className="border-t border-gray-100">
                <td className="whitespace-nowrap py-1.5 pr-3 text-ink">{stat.label}</td>
                {stat.byCity.map((c) => (
                  <td key={c.citySlug} className="py-1.5 pr-3 text-ink">
                    {c.total}
                  </td>
                ))}
                <td className="py-1.5 pr-3 font-medium text-ink">{stat.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
