"use client";

import { useState } from "react";
import type { RecordCountCityStat } from "@/lib/record-count-stats";

const BAR_COLOR = "#0891B2"; // cyan-600, validado junto con el resto de la paleta del skill dataviz

const BAR_HEIGHT = 18;
const BAR_GAP = 10;
const CHART_WIDTH = 560;
const LABEL_WIDTH = 168;
// Ver el mismo comentario en RecordCountByCityChart.tsx: sin este margen, el
// número de la barra con el total más alto queda fuera del viewBox.
const VALUE_WIDTH = 30;

// Cuántas órdenes de pieza se levantaron este mes, por ciudad (ver
// lib/piece-order-stats.ts). Solo tiene sentido en Administración, igual que
// el resto de las gráficas de ese apartado.
export function PieceOrderStatsChart({
  stats,
  monthLabel,
}: {
  stats: RecordCountCityStat[];
  monthLabel: string;
}) {
  const [showTable, setShowTable] = useState(false);

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
          <p className="text-xs text-gray-500">{monthLabel} · se reinicia cada mes</p>
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
                <tr key={stat.citySlug} className="border-t border-gray-100">
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
                <g key={stat.citySlug}>
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
    </div>
  );
}
