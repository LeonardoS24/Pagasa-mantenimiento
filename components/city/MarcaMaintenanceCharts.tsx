import type { MarcaMaintenanceGroup } from "@/lib/piece-maintenance-by-marca";
import { accionPiezaOptions, type AccionPieza } from "@/lib/piece-catalog";
import type { PieceMaintenanceStat } from "@/lib/piece-maintenance-stats";

// Mismos colores que PieceMaintenanceChart.tsx (validados con
// scripts/validate_palette.js del skill dataviz), para que ambos gráficos
// se lean como parte del mismo sistema visual.
const ACCION_COLORS: Record<AccionPieza, string> = {
  Sustitución: "#2563EB",
  Reparación: "#EA580C",
  "Mantenimiento preventivo": "#059669",
};

const BAR_HEIGHT = 16;
const BAR_GAP = 8;
const SEGMENT_GAP = 2;
const CHART_WIDTH = 480;
const LABEL_WIDTH = 150;
const VALUE_WIDTH = 26;

function statLabel(stat: PieceMaintenanceStat): string {
  const label = stat.categoria ? `${stat.pieza} (${stat.categoria})` : stat.pieza;
  return label.length > 24 ? `${label.slice(0, 23)}…` : label;
}

function MarcaBarChart({ group }: { group: MarcaMaintenanceGroup }) {
  const maxTotal = Math.max(...group.stats.map((s) => s.total));
  const plotWidth = CHART_WIDTH - LABEL_WIDTH - VALUE_WIDTH;
  const svgHeight = group.stats.length * (BAR_HEIGHT + BAR_GAP);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h4 className="mb-3 text-sm font-semibold text-primary-bright">{group.marca}</h4>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${CHART_WIDTH} ${svgHeight}`} width="100%" height={svgHeight} role="img" aria-label={`Piezas con más mantenimiento en ${group.marca}`}>
          {group.stats.map((stat, rowIndex) => {
            const y = rowIndex * (BAR_HEIGHT + BAR_GAP);
            let cursorX = LABEL_WIDTH;
            const segments = accionPiezaOptions
              .map((accion) => ({ accion, count: stat.porAccion[accion] }))
              .filter((seg) => seg.count > 0);

            return (
              <g key={`${stat.categoria ?? ""}::${stat.pieza}`}>
                <text
                  x={LABEL_WIDTH - 8}
                  y={y + BAR_HEIGHT / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="fill-gray-600"
                  fontSize="10"
                >
                  {statLabel(stat)}
                  <title>{stat.categoria ? `${stat.pieza} (${stat.categoria})` : stat.pieza}</title>
                </text>
                {segments.map((seg, segIndex) => {
                  const segWidth = maxTotal > 0 ? (seg.count / maxTotal) * plotWidth : 0;
                  const isLast = segIndex === segments.length - 1;
                  const x = cursorX;
                  cursorX += segWidth + (isLast ? 0 : SEGMENT_GAP);
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
                      opacity={0.9}
                    >
                      {/* Un solo nodo de texto, ver el comentario en
                          EquipmentMaintenanceTypePieChart.tsx. */}
                      <title>{`${stat.pieza} · ${seg.accion}: ${seg.count}`}</title>
                    </rect>
                  );
                })}
                <text x={cursorX + 6} y={y + BAR_HEIGHT / 2} dominantBaseline="middle" className="fill-ink" fontSize="10" fontWeight={600}>
                  {stat.total}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

// Compara, por marca de vehículo (ver lib/vehicle-brand-catalog.ts y
// lib/piece-maintenance-by-marca.ts), qué piezas reciben más mantenimiento
// — un gráfico chico por marca en vez de uno solo mezclando todas las
// unidades, para poder comparar entre tipos de unidad. Se muestra tanto en
// la Bitácora de unidades de cada ciudad (su propia flota) como en la de
// Administración (todas combinadas, "en general"; cada ciudad se ve entrando
// a su propia Bitácora de unidades).
export function MarcaMaintenanceCharts({
  groups,
  monthLabel,
}: {
  groups: MarcaMaintenanceGroup[];
  monthLabel: string;
}) {
  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">
          Piezas con más mantenimiento por marca
        </h3>
        <p className="text-xs text-gray-500">{monthLabel} · se reinicia cada mes</p>
      </div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1">
        {accionPiezaOptions.map((accion) => (
          <span key={accion} className="flex items-center gap-1.5 text-xs text-ink">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ACCION_COLORS[accion] }} />
            {accion}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <MarcaBarChart key={group.marca} group={group} />
        ))}
      </div>
    </div>
  );
}
