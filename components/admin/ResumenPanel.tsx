import Link from "next/link";
import { getAllRealCityIds } from "@/lib/aggregate-city";
import {
  YEARLY_SUMMARY_TYPES,
  STATION_SUMMARY_TYPES,
  summaryTypesForAmbito,
  yearlySummaryLabels,
  yearlySummaryRouteSlugs,
  yearlySummaryAnchors,
  getYearlySummary,
  getYearlySummaryOverview,
  getYearlySummaryAllMissing,
  type YearlySummaryTypeId,
  type ResumenAmbito,
} from "@/lib/yearly-change-summary";
import { getComplianceByUnit } from "@/lib/compliance-stats";
import { complianceGaugeLevel, complianceGaugeColors, type ComplianceAmbito } from "@/lib/compliance-checklist";
import { verRecordLabel } from "@/lib/section-labels";
import { getStationsForSealSelect, getStationSeals } from "@/lib/seal-stats";
import { formatDate } from "@/lib/dates";
import { YearlyDueList } from "./YearlyDueList";

function tabsForAmbito(ambito: ResumenAmbito) {
  return [
    { slug: "general", label: "Resumen general" },
    { slug: "cumplimiento", label: "Cumplimiento normativo" },
    // Los sellos solo existen en Estaciones de carburación (ver apartado
    // "Sellos" en la página de detalle del vehículo).
    ...(ambito === "ESTACIONES" ? [{ slug: "sellos", label: "Sellos" }] : []),
    ...summaryTypesForAmbito(ambito).map((type) => ({
      slug: yearlySummaryRouteSlugs[type],
      label: yearlySummaryLabels[type],
    })),
    { slug: "sin-informacion", label: "Sin información" },
  ];
}

const typeBySlug = new Map<string, YearlySummaryTypeId>(
  [...YEARLY_SUMMARY_TYPES, ...STATION_SUMMARY_TYPES].map((type) => [yearlySummaryRouteSlugs[type], type])
);

const AMBITOS: { value: ResumenAmbito; label: string }[] = [
  { value: "UNIDADES", label: "Unidades" },
  { value: "ESTACIONES", label: "Estaciones" },
];

// Vivía como sus propias 10 rutas en /admin/resumen; ahora es un solo
// apartado ("Resumen", ver scripts/add-resumen-section.mjs) dentro de la
// ciudad especial Administración, con las mismas pestañas pero cambiando de
// vista por query param (?tab=) en vez de rutas anidadas, igual que el resto
// del catch-all de ciudad/apartado maneja el selector de mes (ver
// app/(protected)/ciudades/[citySlug]/[...sectionPath]/page.tsx). El
// selector Unidades/Estaciones (?ambito=) elige entre las 8 pestañas de
// unidad normal o las 6 de Estación de carburación/Planta (ver
// STATION_SUMMARY_TYPES en lib/yearly-change-summary.ts): son juegos de
// válvulas distintos y una estación no tiene extintor ni mangueras propios.
export async function ResumenPanel({
  citySlug,
  tab,
  ambito,
  estacionId,
}: {
  citySlug: string;
  tab: string;
  ambito: ResumenAmbito;
  // Estación elegida en la pestaña "Sellos" (ver ?estacion= en la URL):
  // ahí hay que seleccionar una para ver sus sellos, no se mezclan todas en
  // una sola lista.
  estacionId?: string;
}) {
  const year = new Date().getFullYear();
  const TABS = tabsForAmbito(ambito);
  const activeTab = TABS.some((t) => t.slug === tab) ? tab : "general";
  const basePath = `/ciudades/${citySlug}/resumen`;
  const ambitoParam = ambito === "ESTACIONES" ? "estaciones" : "unidades";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink">
          Todos los cambios de mantenimiento que vencen en <strong>{year}</strong>, organizados por
          tipo, en todas las ciudades.
        </p>
        <div className="flex gap-2">
          {AMBITOS.map((a) => (
            <Link
              key={a.value}
              href={a.value === "UNIDADES" ? basePath : `${basePath}?ambito=estaciones`}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium ${
                ambito === a.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-gray-300 text-ink hover:bg-gray-50"
              }`}
            >
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <Link
            key={t.slug}
            href={
              t.slug === "general"
                ? ambito === "ESTACIONES" ? `${basePath}?ambito=${ambitoParam}` : basePath
                : `${basePath}?tab=${t.slug}&ambito=${ambitoParam}`
            }
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
        <ResumenGeneralTable year={year} ambito={ambito} />
      ) : activeTab === "cumplimiento" ? (
        <ResumenComplianceList ambito={ambito} />
      ) : activeTab === "sellos" ? (
        <ResumenSealsList citySlug={citySlug} ambitoParam={ambitoParam} estacionId={estacionId} />
      ) : activeTab === "sin-informacion" ? (
        <ResumenMissingList year={year} ambito={ambito} />
      ) : (
        <ResumenTypeList type={typeBySlug.get(activeTab)!} year={year} ambito={ambito} />
      )}
    </div>
  );
}

async function ResumenGeneralTable({ year, ambito }: { year: number; ambito: ResumenAmbito }) {
  const cityIds = await getAllRealCityIds();
  const rows = await getYearlySummaryOverview(cityIds, year, ambito);
  const citySlug = "administracion";
  const ambitoParam = ambito === "ESTACIONES" ? "&ambito=estaciones" : "";

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
                    href={`/ciudades/${citySlug}/resumen?tab=${yearlySummaryRouteSlugs[row.type]}${ambitoParam}`}
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

async function ResumenTypeList({
  type,
  year,
  ambito,
}: {
  type: YearlySummaryTypeId;
  year: number;
  ambito: ResumenAmbito;
}) {
  const cityIds = await getAllRealCityIds();
  const { due, completed } = await getYearlySummary(type, cityIds, year, ambito);

  return (
    <YearlyDueList
      typeLabel={yearlySummaryLabels[type]}
      anchor={yearlySummaryAnchors[type]}
      due={due}
      completed={completed}
    />
  );
}

async function ResumenMissingList({ year, ambito }: { year: number; ambito: ResumenAmbito }) {
  const cityIds = await getAllRealCityIds();
  const groups = await getYearlySummaryAllMissing(cityIds, year, ambito);

  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        No hay información faltante: todas las unidades tienen su fecha capturada en los tipos de
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
            {group.items.map((item, i) => (
              <li key={`${item.id}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
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

// Porcentaje del checklist de cumplimiento de normatividad, unidad por
// unidad (ver lib/compliance-checklist.ts) — a diferencia del medidor de
// Administración (que solo trae el promedio por ámbito), esta lista deja ver
// exactamente cuáles unidades están más atrasadas, ordenadas de menor a
// mayor cumplimiento.
async function ResumenComplianceList({ ambito }: { ambito: ResumenAmbito }) {
  const cityIds = await getAllRealCityIds();
  const complianceAmbitos: ComplianceAmbito[] = ambito === "ESTACIONES" ? ["ESTACION", "PLANTA"] : ["UNIDAD"];
  const filas = await getComplianceByUnit(cityIds, complianceAmbitos);

  if (filas.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay registros de este tipo para calcular su cumplimiento.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-2">Número económico</th>
            <th className="whitespace-nowrap px-4 py-2">Ciudad</th>
            <th className="whitespace-nowrap px-4 py-2">Cumplimiento</th>
            <th className="whitespace-nowrap px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {filas.map((fila) => {
            const nivel = complianceGaugeLevel(fila.porcentaje);
            const colores = complianceGaugeColors[nivel];
            return (
              <tr key={fila.id} className="border-t border-gray-100">
                <td className="whitespace-nowrap px-4 py-2 font-medium text-ink">
                  {fila.numeroEconomico}
                  {!fila.activo && <span className="ml-2 text-xs text-orange-600">(dado de baja)</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{fila.cityName}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  <span className={`font-semibold ${colores.text}`}>{fila.porcentaje}%</span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <Link
                    href={`/ciudades/${fila.citySlug}/vehiculo/${fila.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {verRecordLabel(fila.sectionSlug)} →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Hay que elegir una estación para ver sus sellos (los activos y el
// historial de bajas, con qué perfil dio cada una) — no se mezclan todas
// las estaciones en una sola lista. Ver lib/seal-stats.ts.
async function ResumenSealsList({
  citySlug,
  ambitoParam,
  estacionId,
}: {
  citySlug: string;
  ambitoParam: string;
  estacionId?: string;
}) {
  const cityIds = await getAllRealCityIds();
  const estaciones = await getStationsForSealSelect(cityIds);
  const basePath = `/ciudades/${citySlug}/resumen`;
  const estacionValida = estacionId && estaciones.some((e) => e.id === estacionId) ? estacionId : undefined;

  // Agrupa por ciudad para el <optgroup>, en el mismo orden en que ya
  // vinieron (activas primero, luego alfabético — ver getStationsForSealSelect).
  const porCiudad = new Map<string, typeof estaciones>();
  for (const e of estaciones) {
    const lista = porCiudad.get(e.cityName) ?? [];
    lista.push(e);
    porCiudad.set(e.cityName, lista);
  }

  return (
    <div className="space-y-4">
      <form action={basePath} method="get" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value="sellos" />
        <input type="hidden" name="ambito" value={ambitoParam} />
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="resumen-sellos-estacion">
            Estación
          </label>
          <select
            id="resumen-sellos-estacion"
            name="estacion"
            defaultValue={estacionValida ?? ""}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="" disabled>
              Selecciona una estación...
            </option>
            {[...porCiudad.entries()].map(([cityName, lista]) => (
              <optgroup key={cityName} label={cityName}>
                {lista.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.numeroEconomico}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
        >
          Ver sellos
        </button>
      </form>

      {!estacionValida ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
          Selecciona una estación para ver sus sellos activos y su historial de bajas.
        </p>
      ) : (
        <SealsForStation vehicleId={estacionValida} citySlug={citySlug} estaciones={estaciones} />
      )}
    </div>
  );
}

async function SealsForStation({
  vehicleId,
  citySlug,
  estaciones,
}: {
  vehicleId: string;
  citySlug: string;
  estaciones: Awaited<ReturnType<typeof getStationsForSealSelect>>;
}) {
  const estacion = estaciones.find((e) => e.id === vehicleId)!;
  const { activos, historial } = await getStationSeals(vehicleId);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase text-primary-bright">
          {estacion.numeroEconomico} ({estacion.cityName})
        </h3>
        <Link
          href={`/ciudades/${citySlug}/vehiculo/${vehicleId}#sellos`}
          className="text-xs font-medium text-primary hover:underline"
        >
          Ver estación →
        </Link>
      </div>

      {activos.length === 0 && historial.length === 0 ? (
        <p className="text-sm text-ink">Esta estación no tiene sellos registrados todavía.</p>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
              Sellos activos ({activos.length})
            </p>
            {activos.length === 0 ? (
              <p className="text-sm text-ink">Ninguno.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
                {activos.map((sello) => (
                  <li key={sello.id} className="px-3 py-2 text-sm text-ink">
                    <span className="font-medium text-primary">{sello.numeroSello}</span>
                    {" — instalado "}
                    {formatDate(sello.fechaInstalacion)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
              Historial de bajas ({historial.length})
            </p>
            {historial.length === 0 ? (
              <p className="text-sm text-ink">Ninguno.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-gray-50">
                {historial.map((sello) => (
                  <li key={sello.id} className="px-3 py-2 text-sm text-gray-600">
                    <span className="font-medium">{sello.numeroSello}</span>
                    {" — instalado "}
                    {formatDate(sello.fechaInstalacion)}
                    {sello.fechaBaja && `, dado de baja ${formatDate(sello.fechaBaja)}`}
                    {sello.deactivatedByUsername && (
                      <>
                        {" por "}
                        <span className="font-medium text-primary">{sello.deactivatedByUsername}</span>
                      </>
                    )}
                    {sello.motivoBaja && ` (${sello.motivoBaja})`}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
