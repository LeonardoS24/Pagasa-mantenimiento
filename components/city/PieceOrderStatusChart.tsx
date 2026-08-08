"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { PieceOrderStatusCityStat, PieceOrderEntry } from "@/lib/piece-order-stats";
import type { MonthRange } from "@/lib/piece-maintenance-stats";
import { fetchPieceOrdersForCity } from "@/actions/piece-order-actions";
import {
  pieceOrderStatusSchema,
  pieceOrderStatusLabels,
  ordenTipoLabels,
  formatCantidad,
  type PieceOrderStatus,
  type OrdenTipo,
} from "@/lib/inventory-enums";
import { formatDate } from "@/lib/dates";

// Mismo esquema de color por estado en toda la gráfica y su leyenda.
const ESTADO_COLORS: Record<PieceOrderStatus, string> = {
  PENDIENTE: "#6B7280", // gray-500
  ACEPTADA: "#059669", // emerald-600
  RECHAZADA: "#DC2626", // red-600
  EN_INVENTARIO: "#2563EB", // blue-600
};

const BAR_HEIGHT = 18;
const BAR_GAP = 14;
const CHART_WIDTH = 560;
const LABEL_WIDTH = 168;
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

// Barra apilada por ciudad, coloreada por estado de la orden (Pendiente,
// Aceptada, Rechazada, En inventario — ver lib/piece-order-stats.ts). A
// diferencia de PieceOrderStatsChart (un solo total por ciudad), aquí cada
// barra se divide en segmentos proporcionales a cuántas órdenes de cada
// estado tiene esa ciudad. Al hacer clic en una ciudad se desglosan todas
// sus órdenes del mes (mismo patrón que el resto de las gráficas).
export function PieceOrderStatusChart({
  stats,
  range,
  monthLabel,
}: {
  stats: PieceOrderStatusCityStat[];
  range: MonthRange;
  monthLabel: string;
}) {
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);

  function toggleCity(cityId: string) {
    setSelectedCityId((current) => (current === cityId ? null : cityId));
  }

  const withActivity = stats.filter((s) => s.total > 0);
  if (withActivity.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">
          Órdenes por ciudad y estado
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
            Órdenes por ciudad y estado
          </h3>
          <p className="text-xs text-gray-500">
            {monthLabel} · se reinicia cada mes · haz clic en una ciudad para ver sus órdenes
          </p>
        </div>
        <ul className="flex flex-wrap gap-3">
          {pieceOrderStatusSchema.options.map((estado) => (
            <li key={estado} className="flex items-center gap-1.5 text-xs text-ink">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: ESTADO_COLORS[estado] }}
              />
              {pieceOrderStatusLabels[estado]}
            </li>
          ))}
        </ul>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${svgHeight}`}
          width="100%"
          height={svgHeight}
          role="img"
          aria-label="Órdenes por ciudad y estado este mes"
        >
          {stats.map((stat, rowIndex) => {
            const y = rowIndex * (BAR_HEIGHT + BAR_GAP);
            const barWidth = maxTotal > 0 ? (stat.total / maxTotal) * plotWidth : 0;
            let cumulative = 0;
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
                {stat.total === 0 ? (
                  <rect x={LABEL_WIDTH} y={y} width={2} height={BAR_HEIGHT} rx={1} ry={1} fill="#E5E7EB" />
                ) : (
                  pieceOrderStatusSchema.options.map((estado) => {
                    const count = stat.porEstado[estado];
                    if (count === 0) return null;
                    const segmentWidth = (count / stat.total) * barWidth;
                    const x = LABEL_WIDTH + cumulative;
                    cumulative += segmentWidth;
                    return (
                      <rect
                        key={estado}
                        x={x}
                        y={y}
                        width={Math.max(segmentWidth, 1)}
                        height={BAR_HEIGHT}
                        fill={ESTADO_COLORS[estado]}
                        opacity={0.9}
                      >
                        <title>
                          {stat.cityName} · {pieceOrderStatusLabels[estado]}: {count}
                        </title>
                      </rect>
                    );
                  })
                )}
                <text
                  x={LABEL_WIDTH + Math.max(barWidth, 4) + 6}
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

      {selectedCityId && (
        <CityBreakdown cityId={selectedCityId} range={range} onClose={() => setSelectedCityId(null)} />
      )}
    </div>
  );
}
