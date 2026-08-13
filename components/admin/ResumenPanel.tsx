import Link from "next/link";
import { getAllRealCityIds } from "@/lib/aggregate-city";
import {
  YEARLY_SUMMARY_TYPES,
  yearlySummaryLabels,
  yearlySummaryRouteSlugs,
  yearlySummaryAnchors,
  getYearlySummary,
  getYearlySummaryOverview,
  getYearlySummaryAllMissing,
  type YearlySummaryTypeId,
} from "@/lib/yearly-change-summary";
import { YearlyDueList } from "./YearlyDueList";

const TABS: { slug: string; label: string }[] = [
  { slug: "general", label: "Resumen general" },
  ...YEARLY_SUMMARY_TYPES.map((type) => ({ slug: yearlySummaryRouteSlugs[type], label: yearlySummaryLabels[type] })),
  { slug: "sin-informacion", label: "Sin información" },
];

const typeBySlug = new Map<string, YearlySummaryTypeId>(
  YEARLY_SUMMARY_TYPES.map((type) => [yearlySummaryRouteSlugs[type], type])
);

// Vivía como sus propias 10 rutas en /admin/resumen; ahora es un solo
// apartado ("Resumen", ver scripts/add-resumen-section.mjs) dentro de la
// ciudad especial Administración, con las mismas pestañas pero cambiando de
// vista por query param (?tab=) en vez de rutas anidadas, igual que el resto
// del catch-all de ciudad/apartado maneja el selector de mes (ver
// app/(protected)/ciudades/[citySlug]/[...sectionPath]/page.tsx).
export async function ResumenPanel({ citySlug, tab }: { citySlug: string; tab: string }) {
  const year = new Date().getFullYear();
  const activeTab = TABS.some((t) => t.slug === tab) ? tab : "general";
  const basePath = `/ciudades/${citySlug}/resumen`;

  return (
    <div>
      <p className="mb-4 text-sm text-ink">
        Todos los cambios de mantenimiento de tanque que vencen en <strong>{year}</strong>, organizados
        por tipo, en todas las ciudades.
      </p>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <Link
            key={t.slug}
            href={t.slug === "general" ? basePath : `${basePath}?tab=${t.slug}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              activeTab === t.slug
                ? "border-accent text-primary"
                : "border-transparent text-ink hover:text-primary"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === "general" ? (
        <ResumenGeneralTable year={year} />
      ) : activeTab === "sin-informacion" ? (
        <ResumenMissingList year={year} />
      ) : (
        <ResumenTypeList type={typeBySlug.get(activeTab)!} year={year} />
      )}
    </div>
  );
}

async function ResumenGeneralTable({ year }: { year: number }) {
  const cityIds = await getAllRealCityIds();
  const rows = await getYearlySummaryOverview(cityIds, year);
  const citySlug = "administracion";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-semibold uppercase text-orange-700">Vencen este año</p>
          <p className="text-2xl font-semibold text-orange-800">
            {rows.reduce((sum, r) => sum + r.due, 0)}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase text-gray-600">Sin información</p>
          <p className="text-2xl font-semibold text-ink">{rows.reduce((sum, r) => sum + r.missing, 0)}</p>
        </div>
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-xs font-semibold uppercase text-green-700">Ya registrados este año</p>
          <p className="text-2xl font-semibold text-green-800">
            {rows.reduce((sum, r) => sum + r.completed, 0)}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="whitespace-nowrap px-4 py-2">Tipo</th>
              <th className="whitespace-nowrap px-4 py-2">Vencen este año</th>
              <th className="whitespace-nowrap px-4 py-2">Sin información</th>
              <th className="whitespace-nowrap px-4 py-2">Ya registrados</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.type} className="border-t border-gray-100">
                <td className="whitespace-nowrap px-4 py-2 font-medium text-ink">
                  <Link
                    href={`/ciudades/${citySlug}/resumen?tab=${yearlySummaryRouteSlugs[row.type]}`}
                    className="text-primary hover:underline"
                  >
                    {row.label}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  {row.due > 0 ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                      {row.due}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  {row.missing > 0 ? (
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {row.missing}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  {row.completed > 0 ? (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      {row.completed}
                    </span>
                  ) : (
                    <span className="text-gray-400">0</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

async function ResumenTypeList({ type, year }: { type: YearlySummaryTypeId; year: number }) {
  const cityIds = await getAllRealCityIds();
  const { due, completed } = await getYearlySummary(type, cityIds, year);

  return (
    <YearlyDueList
      typeLabel={yearlySummaryLabels[type]}
      anchor={yearlySummaryAnchors[type]}
      due={due}
      completed={completed}
    />
  );
}

async function ResumenMissingList({ year }: { year: number }) {
  const cityIds = await getAllRealCityIds();
  const groups = await getYearlySummaryAllMissing(cityIds, year);

  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        No hay información faltante: todas las unidades tienen su fecha capturada en los 8 tipos de
        cambio.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.type} className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-primary-bright">
            {group.label} — sin información ({group.items.length})
          </h2>
          <ul className="divide-y divide-gray-100">
            {group.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-sm text-ink">
                  <span className="font-medium text-primary">{item.numeroEconomico}</span>{" "}
                  <span className="text-gray-500">({item.cityName})</span>
                </span>
                <Link
                  href={`/ciudades/${item.citySlug}/vehiculo/${item.id}#${yearlySummaryAnchors[group.type]}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Buscar y llenar →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
