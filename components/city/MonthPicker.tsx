"use client";

import { useRouter, usePathname } from "next/navigation";

// Selector de mes para la bitácora de unidades de Administración (ver
// lib/aggregate-city.ts): navega a la misma página con ?mes=YYYY-MM, que el
// servidor usa para acotar el feed y las gráficas a ese mes en vez del mes
// en curso (ver lib/dates.ts: parseMonthParam/getMonthRange).
export function MonthPicker({
  months,
  selected,
}: {
  months: { value: string; label: string }[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="mes" className="text-xs font-medium text-ink">
        Mes
      </label>
      <select
        id="mes"
        value={selected}
        onChange={(e) => router.push(`${pathname}?mes=${e.target.value}`)}
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {months.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
