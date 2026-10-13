"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { RecordCountCityStat, RecordTypeKey } from "@/lib/record-count-stats";
import { fetchRecordEntriesForType } from "@/actions/record-drilldown-actions";
import { unitLogEventHref, type UnitLogEvent } from "@/lib/city-unit-log-feed";
import type { MonthRange } from "@/lib/piece-maintenance-stats";
import { formatDate } from "@/lib/dates";

const BAR_HEIGHT = 18;
const BAR_GAP = 10;
const CHART_WIDTH = 560;
const LABEL_WIDTH = 168;
// Espacio reservado a la derecha de la barra para el número de total: sin
// esto, la barra con el valor más alto siempre llega justo al borde del
// viewBox y su número queda recortado (fuera de 0..CHART_WIDTH), invisible.
const VALUE_WIDTH = 30;

function CityBreakdown({
  type,
  cityId,
  range,
  onClose,
}: {
  type: RecordTypeKey;
  cityId: string;
  range: MonthRange;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<UnitLogEvent[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setEntries(null);
    startTransition(async () => {
      const data = await fetchRecordEntriesForType(type, cityId, range);
      setEntries(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, cityId, range]);

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-gray-500">Registros</p>
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
              <Link href={unitLogEventHref(event)} className="text-primary hover:underline">
                {formatDate(event.fecha)} · {event.numeroEconomico}
              </Link>
              <span className="text-gray-500"> — {event.detalle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Gráfico genérico de "cuántos registros de este tipo por ciudad este mes",
// usado una vez por cada uno de los 10 tipos de bitácora de unidad en
// Administración (ver lib/record-count-stats.ts y el catch-all de ciudad).
// Es una sola serie por gráfico, así que el color no necesita ser
// CVD-distinguible contra nada más dentro del mismo gráfico. Al hacer clic en
// una ciudad se desglosan sus registros de ese tipo (ver CityBreakdown).
export function RecordCountByCityChart({
  title,
  type,
  stats,
  range,
  monthLabel,
  color,
}: {
  title: string;
  type: RecordTypeKey;
  stats: RecordCountCityStat[];
  range: MonthRange;
  monthLabel: string;
  color: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

  const withActivity = stats.filter((s) => s.total > 0);
  if (withActivity.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">{title}</h3>
        <p className="mt-2 text-sm text-ink">
          Todavía no hay registros de este tipo en {monthLabel}.
        </p>
      </div>
    );
  }

  const maxTotal = Math.max(...stats.map((s) => s.total));
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - VALUE_WIDTH;
  const svgHeight = stats.length * (BAR_HEIGHT + BAR_GAP);

  function toggleCity(cityId: string) {
    setSelectedCityId((current) => (current === cityId ? null : cityId));
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase text-primary-bright">{title}</h3>
          <p className="text-xs text-gray-500">
            {monthLabel} · se reinicia cada mes · haz clic en una ciudad para ver sus registros
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {showTable ? "Ver gráfico" : "Ver como tabla"}
        </button>
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="py-1 pr-3">Ciudad</th>
                <th className="py-1 pr-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr
                  key={stat.citySlug}
                  onClick={() => toggleCity(stat.cityId)}
                  className={`cursor-pointer border-t border-gray-100 hover:bg-gray-50 ${
                    selectedCityId === stat.cityId ? "bg-accent/5" : ""
                  }`}
                >
                  <td className="py-1.5 pr-3 text-ink">{stat.cityName}</td>
                  <td className="py-1.5 pr-3 font-medium text-ink">{stat.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${svgHeight}`}
            width="100%"
            height={svgHeight}
            role="img"
            aria-label={`${title} por ciudad este mes`}
          >
            {stats.map((stat, rowIndex) => {
              const y = rowIndex * (BAR_HEIGHT + BAR_GAP);
              const width = maxTotal > 0 ? (stat.total / maxTotal) * plotWidth : 0;
              return (
                <g
                  key={stat.citySlug}
                  onClick={() => toggleCity(stat.cityId)}
                  className="cursor-pointer"
                >
                  <rect
                    x={0}
                    y={y - BAR_GAP / 2}
                    width={CHART_WIDTH}
                    height={BAR_HEIGHT + BAR_GAP}
                    fill={selectedCityId === stat.cityId ? "currentColor" : "transparent"}
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
                    {stat.cityName}
                  </text>
                  <rect
                    x={LABEL_WIDTH}
                    y={y}
                    width={Math.max(width, stat.total > 0 ? 2 : 0)}
                    height={BAR_HEIGHT}
                    rx={3}
                    ry={3}
                    fill={color}
                    opacity={0.9}
                  >
                    {/* Un solo nodo de texto, ver el comentario en
                        EquipmentMaintenanceTypePieChart.tsx. */}
                    <title>{`${stat.cityName}: ${stat.total}`}</title>
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
      )}

      {selectedCityId && (
        <CityBreakdown
          type={type}
          cityId={selectedCityId}
          range={range}
          onClose={() => setSelectedCityId(null)}
        />
      )}
    </div>
  );
}
