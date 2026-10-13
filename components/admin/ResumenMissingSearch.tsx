"use client";

import { useState } from "react";
import Link from "next/link";
import {
  yearlySummaryLabels,
  yearlySummaryAnchors,
  type YearlySummaryMissingCityGroup,
} from "@/lib/yearly-change-summary";

// Filtra en el navegador, sin ida y vuelta al servidor: la lista ya viene
// completa desde ResumenPanel (son cientos de registros cuando mucho, no
// miles), así que no hace falta un ?buscar= por query param.
export function ResumenMissingSearch({ groups }: { groups: YearlySummaryMissingCityGroup[] }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filteredGroups = q
    ? groups
        .map((group) => ({
          ...group,
          units: group.units.filter(
            (unit) =>
              unit.numeroEconomico.toLowerCase().includes(q) || group.cityName.toLowerCase().includes(q)
          ),
        }))
        .filter((group) => group.units.length > 0)
    : groups;

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por número económico o ciudad..."
        className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />

      {filteredGroups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
          Ninguna coincide con &quot;{query}&quot;.
        </p>
      ) : (
        filteredGroups.map((group) => (
          <div key={group.citySlug} className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-bright">
              {group.cityName} ({group.units.length})
            </h2>
            <ul className="divide-y divide-gray-100">
              {group.units.map((unit) => (
                <li key={unit.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="text-sm text-ink">
                    <span className="font-medium text-primary">{unit.numeroEconomico}</span>{" "}
                    <span className="text-orange-600">
                      (falta: {unit.missingTypes.map((t) => yearlySummaryLabels[t]).join(", ")})
                    </span>
                  </span>
                  <Link
                    href={`/ciudades/${unit.citySlug}/vehiculo/${unit.id}#${yearlySummaryAnchors[unit.missingTypes[0]]}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Buscar y llenar →
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
