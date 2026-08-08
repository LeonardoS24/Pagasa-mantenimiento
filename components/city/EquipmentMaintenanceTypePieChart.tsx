"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type {
  EquipmentMaintenanceTypeStat,
  EquipmentMaintenanceTypeLogEntry,
} from "@/lib/equipment-maintenance-type-stats";
import type { MonthRange } from "@/lib/piece-maintenance-stats";
import { fetchEquipmentLogsForType } from "@/actions/equipment-log-actions";
import { formatDate } from "@/lib/dates";

// Mismos 3 colores validados que MaintenanceTypePieChart para
// Preventivo/Correctivo/Predictivo, más un cuarto para "Cambio" (exclusivo
// de equipos, ver lib/equipo-enums.ts).
const TIPO_COLORS: Record<string, string> = {
  Preventivo: "#059669",
  Correctivo: "#EA580C",
  Predictivo: "#2563EB",
  Cambio: "#7C3AED",
};

const SIZE = 200;
const RADIUS = 90;
const CENTER = SIZE / 2;

function polarToCartesian(angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CENTER + RADIUS * Math.cos(angleRad), y: CENTER + RADIUS * Math.sin(angleRad) };
}

function arcPath(startAngle: number, endAngle: number): string {
  if (endAngle - startAngle >= 359.99) {
    const mid = polarToCartesian(startAngle + 180);
    const start = polarToCartesian(startAngle);
    return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 1 1 ${mid.x} ${mid.y} A ${RADIUS} ${RADIUS} 0 1 1 ${start.x} ${start.y} Z`;
  }
  const start = polarToCartesian(endAngle);
  const end = polarToCartesian(startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${CENTER} ${CENTER} L ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

function TypeBreakdown({
  tipo,
  cityId,
  range,
  showCity,
  onClose,
}: {
  tipo: string;
  cityId: string | null;
  range: MonthRange;
  showCity: boolean;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<EquipmentMaintenanceTypeLogEntry[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setEntries(null);
    startTransition(async () => {
      const data = await fetchEquipmentLogsForType(cityId, tipo, range);
      setEntries(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, cityId, range]);

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-gray-500">Desglose: {tipo}</p>
        <button type="button" onClick={onClose} className="text-xs text-primary hover:underline">
          Cerrar
        </button>
      </div>

      {isPending || entries === null ? (
        <p className="text-sm text-ink">Cargando...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-ink">No se encontraron mantenimientos de este tipo.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {entries.map((entry) => (
            <li key={entry.id} className="py-1.5 text-sm">
              <Link
                href={`/ciudades/${entry.citySlug}/equipo/${entry.equipoId}?equipoLog=${entry.id}`}
                className="text-primary hover:underline"
              >
                {formatDate(entry.fecha)} · {entry.nombreEquipo}
                {showCity ? ` (${entry.cityName})` : ""}
              </Link>
              <span className="text-gray-500"> — {entry.descripcion}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Porcentaje de mantenimientos de equipo por tipo, con el mismo
// clic-para-desglosar que MaintenanceTypePieChart (ver
// lib/equipment-maintenance-type-stats.ts).
export function EquipmentMaintenanceTypePieChart({
  stats,
  cityId,
  range,
  monthLabel,
  showCity = false,
}: {
  stats: EquipmentMaintenanceTypeStat[];
  cityId: string | null;
  range: MonthRange;
  monthLabel: string;
  showCity?: boolean;
}) {
  const [selectedTipo, setSelectedTipo] = useState<string | null>(null);
  const grandTotal = stats.reduce((sum, s) => sum + s.total, 0);

  if (grandTotal === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">
          Mantenimientos de equipo por tipo
        </h3>
        <p className="mt-2 text-sm text-ink">Todavía no hay mantenimientos registrados en {monthLabel}.</p>
      </div>
    );
  }

  let cumulative = 0;
  const slices = stats
    .filter((s) => s.total > 0)
    .map((s) => {
      const pct = (s.total / grandTotal) * 100;
      const startAngle = (cumulative / grandTotal) * 360;
      cumulative += s.total;
      const endAngle = (cumulative / grandTotal) * 360;
      return { ...s, pct, startAngle, endAngle };
    });

  function toggle(tipo: string) {
    setSelectedTipo((current) => (current === tipo ? null : tipo));
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">
          Mantenimientos de equipo por tipo
        </h3>
        <p className="text-xs text-gray-500">
          {monthLabel} · se reinicia cada mes · haz clic en una rebanada o el nombre para ver el desglose
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={180} height={180} role="img" aria-label="Porcentaje de mantenimientos de equipo por tipo">
          {slices.map((slice) => (
            <path
              key={slice.tipo}
              d={arcPath(slice.startAngle, slice.endAngle)}
              fill={TIPO_COLORS[slice.tipo] ?? "#6B7280"}
              opacity={selectedTipo === null || selectedTipo === slice.tipo ? 0.9 : 0.35}
              className="cursor-pointer"
              onClick={() => toggle(slice.tipo)}
            >
              <title>
                {slice.tipo}: {slice.total} ({slice.pct.toFixed(0)}%)
              </title>
            </path>
          ))}
        </svg>

        <ul className="space-y-2">
          {stats.map((stat) => {
            const pct = grandTotal > 0 ? (stat.total / grandTotal) * 100 : 0;
            return (
              <li key={stat.tipo}>
                <button
                  type="button"
                  onClick={() => toggle(stat.tipo)}
                  disabled={stat.total === 0}
                  className={`flex items-center gap-2 text-sm ${
                    stat.total === 0 ? "cursor-default text-gray-400" : "text-ink hover:underline"
                  }`}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: TIPO_COLORS[stat.tipo] ?? "#6B7280" }}
                  />
                  <span className="font-medium">{stat.tipo}</span>
                  <span className="text-gray-500">
                    {stat.total} ({pct.toFixed(0)}%)
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {selectedTipo && (
        <TypeBreakdown
          tipo={selectedTipo}
          cityId={cityId}
          range={range}
          showCity={showCity}
          onClose={() => setSelectedTipo(null)}
        />
      )}
    </div>
  );
}
