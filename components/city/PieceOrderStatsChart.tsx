"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { RecordCountCityStat } from "@/lib/record-count-stats";
import type { PieceOrderEntry } from "@/lib/piece-order-stats";
import type { MonthRange } from "@/lib/piece-maintenance-stats";
import { fetchPieceOrdersForCity } from "@/actions/piece-order-actions";
import { ordenTipoLabels, pieceOrderStatusLabels, formatCantidad, type OrdenTipo, type PieceOrderStatus } from "@/lib/inventory-enums";
import { formatDate } from "@/lib/dates";

const BAR_COLOR = "#0891B2"; // cyan-600, validado junto con el resto de la paleta del skill dataviz

const BAR_HEIGHT = 18;
const BAR_GAP = 10;
const CHART_WIDTH = 560;
const LABEL_WIDTH = 168;
// Ver el mismo comentario en RecordCountByCityChart.tsx: sin este margen, el
// número de la barra con el total más alto queda fuera del viewBox.
const VALUE_WIDTH = 30;

function CityBreakdown({
  cityId,
  range,
  onClose,
}: {
  cityId: string;
  range: MonthRange;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<PieceOrderEntry[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setEntries(null);
    startTransition(async () => {
      const data = await fetchPieceOrdersForCity(cityId, range);
      setEntries(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityId, range]);

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-gray-500">Órdenes</p>
        <button type="button" onClick={onClose} className="text-xs text-primary hover:underline">
          Cerrar
        </button>
      </div>

      {isPending || entries === null ? (
        <p className="text-sm text-ink">Cargando...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink">No se encontraron órdenes.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {entries.map((entry) => (
            <li key={entry.id} className="py-1.5 text-sm">
              <Link href={`/ciudades/${entry.citySlug}/orden-de-pieza`} className="text-primary hover:underline">
                {formatDate(entry.fechaOrden)} · {entry.nombre}
              </Link>
              <span className="text-gray-500">
                {" "}
                — {ordenTipoLabels[entry.tipo as OrdenTipo] ?? entry.tipo} ·{" "}
                {formatCantidad(entry.cantidad, entry.unidad)} ·{" "}
                {pieceOrderStatusLabels[entry.estado as PieceOrderStatus] ?? entry.estado}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Cuántas órdenes de pieza se levantaron este mes, por ciudad (ver
// lib/piece-order-stats.ts). Solo tiene sentido en Administración, igual que
// el resto de las gráficas de ese apartado. Al hacer clic en una ciudad se
// desglosan sus órdenes (ver CityBreakdown), mismo patrón que
// RecordCountByCityChart.
export function PieceOrderStatsChart({
  stats,
  range,
  monthLabel,
}: {
  stats: RecordCountCityStat[];
  range: MonthRange;
  monthLabel: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

  function toggleCity(cityId: string) {
    setSelectedCityId((current) => (current === cityId ? null : cityId));
  }

  const withActivity = stats.filter((s) => s.total > 0);
  if (withActivity.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">
          Órdenes de pieza por ciudad
        </h3>
        <p className="mt-2 text-sm text-ink">Todavía no hay órdenes registradas en {monthLabel}.</p>
      </div>
    );
  }

  const maxTotal = Math.max(...stats.map((s) => s.total));
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - VALUE_WIDTH;
  const svgHeight = stats.length * (BAR_HEIGHT + BAR_GAP);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase text-primary-bright">
            Órdenes de pieza por ciudad
          </h3>
          <p className="text-xs text-gray-500">
            {monthLabel} · se reinicia cada mes · haz clic en una ciudad para ver sus órdenes
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
                <th className="py-1 pr-3">Órdenes</th>
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
            aria-label="Órdenes de pieza por ciudad este mes"
          >
            {stats.map((stat, rowIndex) => {
              const y = rowIndex * (BAR_HEIGHT + BAR_GAP);
              const width = maxTotal > 0 ? (stat.total / maxTotal) * plotWidth : 0;
              return (
                <g key={stat.citySlug} onClick={() => toggleCity(stat.cityId)} className="cursor-pointer">
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
                    fill={BAR_COLOR}
                    opacity={0.9}
                  >
                    <title>
                      {stat.cityName}: {stat.total}
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
      )}

      {selectedCityId && (
        <CityBreakdown cityId={selectedCityId} range={range} onClose={() => setSelectedCityId(null)} />
      )}
    </div>
  );
}
