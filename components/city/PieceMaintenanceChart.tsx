"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { PieceMaintenanceStat, PieceMaintenanceLogEntry, MonthRange } from "@/lib/piece-maintenance-stats";
import { fetchMaintenanceLogsForPiece, fetchMaintenanceLogsForPieceByVehicle } from "@/actions/piece-maintenance-actions";
import { accionPiezaOptions, type AccionPieza } from "@/lib/piece-catalog";
import { currentMonthLabel, formatDate } from "@/lib/dates";

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
// Espacio reservado a la derecha de la barra para el número de total: sin
// esto, la barra con el valor más alto siempre llega justo al borde del
// viewBox y su número queda recortado (fuera de 0..CHART_WIDTH), invisible.
const VALUE_WIDTH = 30;

// Varios nombres de pieza se repiten en categorías distintas con significados
// distintos (p. ej. "Válvulas" en Motor vs. en Llantas y Rines), así que la
// identidad de cada fila es categoría + pieza, no solo la pieza.
function statKey(stat: PieceMaintenanceStat): string {
  return `${stat.categoria ?? ""}::${stat.pieza}`;
}

function statLabel(stat: PieceMaintenanceStat): string {
  return stat.categoria ? `${stat.pieza} (${stat.categoria})` : stat.pieza;
}

// A qué unidades/ciudad acota el gráfico: una ciudad (o todas combinadas en
// Administración, cityId null) como siempre, o una sola unidad — el gráfico
// propio de cada vehículo (ver el apartado de cada unidad), que además se
// reinicia cada año en vez de cada mes.
export type PieceMaintenanceScope =
  // sectionSlugs opcional: acota a un subconjunto de apartados (p.ej. solo
  // Estaciones/Planta, ver Bitácora de estaciones) sin cambiar de ciudad.
  | { type: "city"; cityId: string | null; sectionSlugs?: string[] }
  | { type: "vehicle"; vehicleRecordId: string };

// Desglose de una fila del gráfico: qué mantenimientos concretos suman ese
// total, con un link directo a la bitácora de esa unidad (ver
// components/city/MaintenanceLogRow.tsx, que se auto-expande y se resalta
// cuando llega ?mantenimiento=<id> en la URL).
function PieceBreakdown({
  stat,
  scope,
  range,
  showCity,
  onClose,
}: {
  stat: PieceMaintenanceStat;
  scope: PieceMaintenanceScope;
  range: MonthRange;
  showCity: boolean;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<PieceMaintenanceLogEntry[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setEntries(null);
    startTransition(async () => {
      const data =
        scope.type === "vehicle"
          ? await fetchMaintenanceLogsForPieceByVehicle(scope.vehicleRecordId, stat.categoria, stat.pieza, range)
          : await fetchMaintenanceLogsForPiece(scope.cityId, stat.categoria, stat.pieza, range, scope.sectionSlugs);
      setEntries(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stat.categoria, stat.pieza, scope, range]);

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-gray-500">
          Desglose: {statLabel(stat)}
        </p>
        <button type="button" onClick={onClose} className="text-xs text-primary hover:underline">
          Cerrar
        </button>
      </div>

      {isPending || entries === null ? (
        <p className="text-sm text-ink">Cargando...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink">No se encontraron los mantenimientos de esta pieza.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {entries.map((entry) => (
            <li key={entry.id} className="py-1.5 text-sm">
              <Link
                href={`/ciudades/${entry.citySlug}/vehiculo/${entry.vehicleRecordId}?mantenimiento=${entry.id}`}
                className="text-primary hover:underline"
              >
                {formatDate(entry.fecha)} · {entry.numeroEconomico}
                {showCity ? ` (${entry.cityName})` : ""}
              </Link>
              <span className="text-gray-500"> — {entry.accion} · {entry.tipoServicio}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PieceMaintenanceChart({
  stats,
  scope,
  range,
  monthLabel = currentMonthLabel(),
  periodo = "mes",
}: {
  stats: PieceMaintenanceStat[];
  // A qué se acota el gráfico: una ciudad (o Administración combinada, con
  // cityId null) o una sola unidad (ver PieceMaintenanceScope arriba).
  scope: PieceMaintenanceScope;
  // Mismo rango que ya se usó para calcular "stats", para que el desglose
  // sume exactamente igual que la barra en la que se hizo clic.
  range: MonthRange;
  // Etiqueta del periodo mostrado: el mes elegido en Administración (ver
  // components/city/MonthPicker.tsx), o el año en curso para el gráfico por
  // unidad (ver periodo).
  monthLabel?: string;
  // El gráfico de cada unidad se reinicia cada año, no cada mes.
  periodo?: "mes" | "año";
}) {
  const [hovered, setHovered] = useState<{ key: string; accion: AccionPieza } | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  if (stats.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay mantenimientos con pieza y acción capturadas en {monthLabel}.
      </p>
    );
  }

  const maxTotal = Math.max(...stats.map((s) => s.total));
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - VALUE_WIDTH;
  const svgHeight = stats.length * (BAR_HEIGHT + BAR_GAP);
  const selectedStat = stats.find((s) => statKey(s) === selectedKey) ?? null;

  function toggleSelected(key: string) {
    setSelectedKey((current) => (current === key ? null : key));
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold uppercase text-primary-bright">
            Piezas con más mantenimiento
          </h3>
          <p className="text-xs text-gray-500">
            {monthLabel} · se reinicia cada {periodo} · haz clic en una pieza para ver el desglose
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
                <tr
                  key={statKey(stat)}
                  onClick={() => toggleSelected(statKey(stat))}
                  className={`cursor-pointer border-t border-gray-100 hover:bg-gray-50 ${
                    selectedKey === statKey(stat) ? "bg-accent/5" : ""
                  }`}
                >
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
                <g
                  key={key}
                  onClick={() => toggleSelected(key)}
                  className="cursor-pointer"
                >
                  <rect
                    x={0}
                    y={y - BAR_GAP / 2}
                    width={CHART_WIDTH}
                    height={BAR_HEIGHT + BAR_GAP}
                    fill={selectedKey === key ? "currentColor" : "transparent"}
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

      {selectedStat && (
        <PieceBreakdown
          stat={selectedStat}
          scope={scope}
          range={range}
          showCity={scope.type === "city" && scope.cityId === null}
          onClose={() => setSelectedKey(null)}
        />
      )}
    </div>
  );
}
