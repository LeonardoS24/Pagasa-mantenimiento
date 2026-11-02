import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { idsDeTrabajo } from "@/lib/ciudades-de-trabajo";
import { MESES, getProgramaAnual } from "@/lib/programa-anual";
import { apartadosConUnidades } from "@/lib/apartados-con-unidades";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrintButton } from "@/components/city/PrintButton";
import { FiltroApartado } from "@/components/normatividad/FiltroApartado";

// Programa anual de mantenimiento e inspecciones (ver lib/programa-anual.ts):
// matriz unidad × mes para imprimir y firmar; en celular, lista por mes.
export const dynamic = "force-dynamic";

const fecha = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;

function Marcas({ marcas }: { marcas: ("P" | "R")[] }) {
  if (marcas.length === 0) return null;
  return (
    <span className="flex justify-center gap-0.5">
      {marcas.map((m) => (
        <span
          key={m}
          className={`inline-block min-w-[1.25rem] rounded px-1 text-center text-[11px] font-bold ${
            m === "R" ? "bg-green-600 text-white print:bg-transparent print:text-green-800" : "border border-primary text-primary"
          }`}
        >
          {m}
        </span>
      ))}
    </span>
  );
}

export default async function ProgramaAnualPage({
  params,
  searchParams,
}: {
  params: { citySlug: string };
  searchParams: { anio?: string; apartado?: string };
}) {
  const user = await requireUser();
  const city = await assertCityAccess(user, params.citySlug);
  const ids = await idsDeTrabajo(user, city);
  const actual = new Date().getFullYear();
  const anio = Math.min(actual + 10, Math.max(2000, Number(searchParams.anio) || actual));
  const [{ filas, atrasados, totales }, apartados] = await Promise.all([
    getProgramaAnual(ids, anio, searchParams.apartado || undefined),
    apartadosConUnidades(ids),
  ]);
  const query = new URLSearchParams({ anio: String(anio), ...(searchParams.apartado ? { apartado: searchParams.apartado } : {}) }).toString();
  const nombreApartado = searchParams.apartado ? apartados.find((a) => a.slug === searchParams.apartado)?.nombre : null;

  return (
    <div className="space-y-5">
      {/* Hoja horizontal al imprimir: son 12 meses. */}
      <style>{`@media print { @page { size: letter landscape; margin: 10mm; } }`}</style>
      <div className="print:hidden">
        <Breadcrumb items={[{ label: "Inicio", href: "/dashboard" }, { label: city.name, href: `/ciudades/${city.slug}` }, { label: "Programa anual" }]} />
      </div>

      <header className="space-y-1 border-b border-gray-300 pb-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">Grupo Pagasa · Sistema Integral de Mantenimiento</p>
        <h1 className="text-2xl font-semibold text-primary">Programa anual de mantenimiento e inspecciones {anio}</h1>
        <p className="text-sm text-ink">
          {city.name}
          {nombreApartado && ` · ${nombreApartado}`} · <span className="font-semibold text-primary">P</span> programado (pendiente) ·{" "}
          <span className="font-semibold text-green-700">R</span> realizado
        </p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <FiltroApartado
          apartados={apartados}
          actual={searchParams.apartado}
          extra={
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-gray-500">Año</span>
              <select name="anio" defaultValue={anio} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                {Array.from({ length: 7 }, (_, i) => actual - 3 + i).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          }
        />
        <div className="flex flex-wrap gap-2">
          <a href={`/api/ciudades/${city.slug}/programa-anual?${query}`} className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5">
            Descargar Excel
          </a>
          <PrintButton label="Imprimir o guardar PDF" />
        </div>
      </div>

      {atrasados.length > 0 && (
        <section className="rounded-lg border border-red-300 bg-red-50 p-3 print:break-inside-avoid">
          <h2 className="mb-1 text-sm font-semibold text-red-800">Atrasado de años anteriores ({atrasados.length})</h2>
          <ul className="grid gap-x-4 text-sm text-red-900 sm:grid-cols-2">
            {atrasados.map((a, i) => (
              <li key={i}>
                <Link href={`/ciudades/${a.citySlug}/vehiculo/${a.vehicleId}`} className="font-medium hover:underline">
                  {a.numeroEconomico}
                </Link>{" "}
                · {a.actividad}
                {a.detalle && ` (${a.detalle})`} · venció {fecha(a.vencio)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {filas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-ink">
          No hay actividades programadas ni realizadas en {anio} con esos filtros.
        </p>
      ) : (
        <>
          {/* Pantalla grande e impresión: la matriz. */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 bg-white md:block print:block print:overflow-visible print:border-gray-400">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-primary text-white print:bg-transparent print:text-ink">
                  <th className="border border-gray-300 px-2 py-1 text-left">Unidad</th>
                  <th className="border border-gray-300 px-2 py-1 text-left">Actividad</th>
                  {MESES.map((m) => (
                    <th key={m} className="w-9 border border-gray-300 px-1 py-1">
                      {m}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={f.clave} className={`print:break-inside-avoid ${i % 2 ? "bg-slate-50" : ""}`}>
                    <td className="border border-gray-200 px-2 py-1 align-top">
                      <Link href={`/ciudades/${f.citySlug}/vehiculo/${f.vehicleId}`} className="font-medium text-primary hover:underline print:text-ink print:no-underline">
                        {f.numeroEconomico}
                      </Link>
                      <span className="block text-[10px] text-gray-500">
                        {f.sectionName}
                        {ids.length > 1 && ` · ${f.cityName}`}
                      </span>
                    </td>
                    <td className="border border-gray-200 px-2 py-1">
                      {f.actividad}
                      {f.detalle && <span className="block text-[10px] text-gray-500">{f.detalle}</span>}
                    </td>
                    {f.meses.map((m, mes) => (
                      <td key={mes} className="border border-gray-200 px-0.5 py-1">
                        <Marcas marcas={m} />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-gray-100 font-semibold">
                  <td colSpan={2} className="border border-gray-300 px-2 py-1 text-right">
                    Programado / realizado
                  </td>
                  {totales.map((t, mes) => (
                    <td key={mes} className="border border-gray-300 px-0.5 py-1 text-center">
                      {t.programados}/{t.realizados}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Celular: por mes. */}
          <div className="space-y-3 md:hidden print:hidden">
            {MESES.map((m, mes) => {
              const delMes = filas.filter((f) => f.meses[mes].length > 0);
              if (delMes.length === 0) return null;
              return (
                <section key={m} className="rounded-lg border border-gray-200 bg-white p-3">
                  <h2 className="mb-1 text-sm font-semibold text-primary">
                    {m} {anio}{" "}
                    <span className="font-normal text-gray-500">
                      · {totales[mes].programados} pendiente(s), {totales[mes].realizados} realizada(s)
                    </span>
                  </h2>
                  <ul className="divide-y divide-gray-100">
                    {delMes.map((f) => (
                      <li key={f.clave} className="flex items-start justify-between gap-2 py-1.5 text-sm">
                        <span>
                          <Link href={`/ciudades/${f.citySlug}/vehiculo/${f.vehicleId}`} className="font-medium text-primary">
                            {f.numeroEconomico}
                          </Link>{" "}
                          <span className="text-ink">{f.actividad}</span>
                          {f.detalle && <span className="block text-xs text-gray-500">{f.detalle}</span>}
                        </span>
                        <Marcas marcas={f.meses[mes]} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}

      <footer className="hidden grid-cols-3 gap-8 pt-12 text-center text-xs text-gray-700 print:grid">
        {["Elaboró", "Revisó", "Autorizó"].map((f) => (
          <div key={f} className="border-t border-gray-500 pt-1">
            {f}
            <br />
            Nombre y firma
          </div>
        ))}
      </footer>
    </div>
  );
}
