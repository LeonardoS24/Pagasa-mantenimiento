"use client";

import { useState } from "react";
import type { PieceMaintenanceStat } from "@/lib/piece-maintenance-stats";
import { accionPiezaOptions, type AccionPieza } from "@/lib/piece-catalog";

// Colores validados con scripts/validate_palette.js del skill dataviz (CVD
// separation, contraste y banda de luminosidad en verde para las 3 series).
const ACCION_COLORS: Record<AccionPieza, string> = {
  Sustitución: "#2563EB",
  Reparación: "#EA580C",
  "Mantenimiento preventivo": "#059669",
};

const BAR_HEIGHT = 18;
const BAR_GAP = 10;
const SEGMENT_GAP = 2;
const CHART_WIDTH = 560;
const LABEL_WIDTH = 168;

// Varios nombres de pieza se repiten en categorías distintas con significados
// distintos (p. ej. "Válvulas" en Motor vs. en Llantas y Rines), así que la
// identidad de cada fila es categoría + pieza, no solo la pieza.
function statKey(stat: PieceMaintenanceStat): string {
  return `${stat.categoria ?? ""}::${stat.pieza}`;
}

function statLabel(stat: PieceMaintenanceStat): string {
  return stat.categoria ? `${stat.pieza} (${stat.categoria})` : stat.pieza;
}

export function PieceMaintenanceChart({ stats }: { stats: PieceMaintenanceStat[] }) {
  const [hovered, setHovered] = useState<{ key: string; accion: AccionPieza } | null>(null);
  const [showTable, setShowTable] = useState(false);

  if (stats.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay suficientes mantenimientos con pieza y acción capturadas para graficar.
      </p>
    );
  }

  const maxTotal = Math.max(...stats.map((s) => s.total));
  const plotWidth = CHART_WIDTH - LABEL_WIDTH;
  const svgHeight = stats.length * (BAR_HEIGHT + BAR_GAP);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">
          Piezas con más mantenimiento
        </h3>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-medium text-primary hover:underline"
        >
          {showTable ? "Ver gráfico" : "Ver como tabla"}
        </button>
      </div>

      {/* Leyenda: siempre visible con 3 series, cada una con su propio color
          además del texto (nunca solo color). */}
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
        {accionPiezaOptions.map((accion) => (
          <span key={accion} className="flex items-center gap-1.5 text-xs text-ink">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: ACCION_COLORS[accion] }}
            />
            {accion}
          </span>
        ))}
      </div>

      {showTable ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="py-1 pr-3">Pieza</th>
                <th className="py-1 pr-3">Categoría</th>
                {accionPiezaOptions.map((accion) => (
                  <th key={accion} className="whitespace-nowrap py-1 pr-3">
                    {accion}
                  </th>
                ))}
                <th className="py-1 pr-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr key={statKey(stat)} className="border-t border-gray-100">
                  <td className="py-1.5 pr-3 text-ink">{stat.pieza}</td>
                  <td className="py-1.5 pr-3 text-gray-500">{stat.categoria ?? "—"}</td>
                  {accionPiezaOptions.map((accion) => (
                    <td key={accion} className="py-1.5 pr-3 text-ink">
                      {stat.porAccion[accion]}
                    </td>
                  ))}
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
            aria-label="Piezas con más mantenimiento, desglosadas por acción"
          >
            {stats.map((stat, rowIndex) => {
              const key = statKey(stat);
              const label = statLabel(stat);
              const y = rowIndex * (BAR_HEIGHT + BAR_GAP);
              let cursorX = LABEL_WIDTH;
              const segments = accionPiezaOptions
                .map((accion) => ({ accion, count: stat.porAccion[accion] }))
                .filter((seg) => seg.count > 0);

              return (
                <g key={key}>
                  <text
                    x={LABEL_WIDTH - 8}
                    y={y + BAR_HEIGHT / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-gray-600"
                    fontSize="11"
                  >
                    {label.length > 26 ? `${label.slice(0, 25)}…` : label}
                    <title>{label}</title>
                  </text>

                  {segments.map((seg, segIndex) => {
                    const segWidth = maxTotal > 0 ? (seg.count / maxTotal) * plotWidth : 0;
                    const isLast = segIndex === segments.length - 1;
                    const x = cursorX;
                    cursorX += segWidth + (isLast ? 0 : SEGMENT_GAP);
                    const isHovered = hovered?.key === key && hovered.accion === seg.accion;

                    // Cada tramo lleva un ligero redondeo propio y queda separado
                    // del siguiente por SEGMENT_GAP: así se distinguen sin
                    // depender solo del color (accesible a daltonismo).
                    return (
                      <rect
                        key={seg.accion}
                        x={x}
                        y={y}
                        width={Math.max(segWidth, 1)}
                        height={BAR_HEIGHT}
                        rx={3}
                        ry={3}
                        fill={ACCION_COLORS[seg.accion]}
                        opacity={isHovered ? 1 : 0.9}
                        onMouseEnter={() => setHovered({ key, accion: seg.accion })}
                        onMouseLeave={() => setHovered(null)}
                      >
                        <title>
                          {label} · {seg.accion}: {seg.count}
                        </title>
                      </rect>
                    );
                  })}

                  <text
                    x={cursorX + 6}
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
