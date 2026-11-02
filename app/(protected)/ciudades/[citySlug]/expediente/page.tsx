import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { idsDeTrabajo } from "@/lib/ciudades-de-trabajo";
import { getExpediente, type EstadoRequisito } from "@/lib/expediente";
import { apartadosConUnidades } from "@/lib/apartados-con-unidades";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { PrintButton } from "@/components/city/PrintButton";
import { FiltroApartado } from "@/components/normatividad/FiltroApartado";

// Expediente de cumplimiento normativo para auditoría (ver lib/expediente.ts).
// Se imprime o se guarda como PDF desde el navegador; en celular cada
// requisito se ve como tarjeta.
export const dynamic = "force-dynamic";

const ESTADO: Record<EstadoRequisito, { texto: string; clase: string }> = {
  vencido: { texto: "Vencido", clase: "bg-red-100 text-red-800 print:border print:border-red-700" },
  porVencer: { texto: "Por vencer", clase: "bg-amber-100 text-amber-900 print:border print:border-amber-700" },
  sinDato: { texto: "Sin dato", clase: "bg-gray-200 text-gray-800 print:border print:border-gray-600" },
  vigente: { texto: "Vigente", clase: "bg-green-100 text-green-800 print:border print:border-green-700" },
};

const fecha = (d: Date | null) =>
  d ? `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}` : "—";

export default async function ExpedientePage({
  params,
  searchParams,
}: {
  params: { citySlug: string };
  searchParams: { apartado?: string; unidad?: string };
}) {
  const user = await requireUser();
  const city = await assertCityAccess(user, params.citySlug);
  const ids = await idsDeTrabajo(user, city);
  const [unidades, apartados] = await Promise.all([
    getExpediente(ids, { apartado: searchParams.apartado || undefined, unidad: searchParams.unidad || undefined }),
    apartadosConUnidades(ids),
  ]);
  const total: Record<EstadoRequisito, number> = { vencido: 0, porVencer: 0, sinDato: 0, vigente: 0 };
  for (const u of unidades) for (const k of Object.keys(total) as EstadoRequisito[]) total[k] += u.conteo[k];
  const requisitos = Object.values(total).reduce((a, b) => a + b, 0);
  const cumplimiento = requisitos ? Math.round((total.vigente / requisitos) * 100) : null;
  const hoy = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  const query = new URLSearchParams(Object.entries(searchParams).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="mx-auto max-w-5xl space-y-5 print:max-w-none">
      <div className="print:hidden">
        <Breadcrumb items={[{ label: "Inicio", href: "/dashboard" }, { label: city.name, href: `/ciudades/${city.slug}` }, { label: "Expediente de cumplimiento" }]} />
      </div>

      <header className="space-y-1 border-b border-gray-300 pb-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">Grupo Pagasa · Sistema Integral de Mantenimiento</p>
        <h1 className="text-2xl font-semibold text-primary">Expediente de cumplimiento normativo</h1>
        <p className="text-sm text-ink">
          {city.name}
          {searchParams.apartado && ` · ${apartados.find((a) => a.slug === searchParams.apartado)?.nombre ?? searchParams.apartado}`}
          {searchParams.unidad && unidades[0] && ` · ${unidades[0].numeroEconomico}`} · Emitido el {hoy} por {user.username}
        </p>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <FiltroApartado apartados={apartados} actual={searchParams.apartado} />
        <div className="flex flex-wrap gap-2">
          <a href={`/api/ciudades/${city.slug}/expediente${query ? `?${query}` : ""}`} className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5">
            Descargar Excel
          </a>
          <PrintButton label="Imprimir o guardar PDF" />
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-3 sm:col-span-1">
          <p className="text-xs text-gray-500">Cumplimiento</p>
          <p className="text-2xl font-semibold text-primary">{cumplimiento === null ? "—" : `${cumplimiento}%`}</p>
          <p className="text-[11px] text-gray-500">requisitos vigentes de {requisitos}</p>
        </div>
        {(["vencido", "porVencer", "sinDato", "vigente"] as EstadoRequisito[]).map((e) => (
          <div key={e} className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">{ESTADO[e].texto}</p>
            <p className="text-2xl font-semibold text-ink">{total[e]}</p>
          </div>
        ))}
      </section>
      <p className="text-xs text-gray-500">
        «Sin dato»: lo que la norma pide a ese tipo de unidad y no tiene fecha capturada en el sistema. «Por vencer»: 30 días o
        menos. Documentos: los adjuntos del último registro de ese tipo en la bitácora de la unidad.
      </p>

      {unidades.length === 0 && (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-ink">No hay unidades con esos filtros.</p>
      )}

      {unidades.map((u, i) => (
        <article key={u.id} className={`rounded-lg border border-gray-200 bg-white p-4 print:rounded-none print:border-gray-400 ${i > 0 ? "print:break-before-page" : ""}`}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-2">
            <div>
              <h2 className="text-lg font-semibold text-primary">
                <Link href={`/ciudades/${u.citySlug}/vehiculo/${u.id}`} className="hover:underline print:no-underline">
                  {u.numeroEconomico}
                </Link>
              </h2>
              <p className="text-xs text-gray-600">
                {u.sectionName} · {u.cityName}
                {u.datos && ` · ${u.datos}`}
              </p>
            </div>
            <p className="text-xs text-gray-600">
              {u.conteo.vencido > 0 && <span className="mr-2 font-semibold text-red-700">{u.conteo.vencido} vencido(s)</span>}
              {u.conteo.porVencer > 0 && <span className="mr-2 font-semibold text-amber-800">{u.conteo.porVencer} por vencer</span>}
              {u.conteo.sinDato > 0 && <span className="mr-2 text-gray-700">{u.conteo.sinDato} sin dato</span>}
              <span className="text-green-800">{u.conteo.vigente} vigente(s)</span>
            </p>
          </div>
          {u.elementos.length === 0 ? (
            <p className="text-sm text-gray-500">Este tipo de unidad no tiene requisitos con fecha en el sistema.</p>
          ) : (
            <>
              {/* Encabezado de columnas: solo en pantalla grande e impresión. */}
              <div className="hidden grid-cols-[1.6fr_2fr_0.8fr_0.8fr_0.9fr_0.9fr] gap-2 border-b border-gray-200 pb-1 text-[11px] font-semibold uppercase text-gray-500 sm:grid print:grid">
                <span>Requisito</span>
                <span>Fundamento</span>
                <span>Vence</span>
                <span>Estado</span>
                <span>Último registro</span>
                <span>Documentos</span>
              </div>
              <ul className="divide-y divide-gray-100">
                {u.elementos.map((e) => (
                  <li
                    key={e.clave}
                    className="grid grid-cols-2 gap-x-3 gap-y-1 py-2 text-sm sm:grid-cols-[1.6fr_2fr_0.8fr_0.8fr_0.9fr_0.9fr] sm:items-center print:grid-cols-[1.6fr_2fr_0.8fr_0.8fr_0.9fr_0.9fr] print:break-inside-avoid"
                  >
                    <span className="col-span-2 font-medium text-ink sm:col-span-1 print:col-span-1">
                      {e.requisito}
                      {e.detalle && <span className="block text-xs font-normal text-gray-500">{e.detalle}</span>}
                    </span>
                    <span className="col-span-2 font-serif text-xs italic text-gray-700 sm:col-span-1 print:col-span-1">{e.fundamento}</span>
                    <span>
                      <span className="text-[11px] text-gray-500 sm:hidden print:hidden">Vence: </span>
                      {fecha(e.vence)}
                    </span>
                    <span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO[e.estado].clase}`}>{ESTADO[e.estado].texto}</span>
                    </span>
                    <span className="text-xs text-gray-600">
                      <span className="text-[11px] text-gray-500 sm:hidden print:hidden">Último registro: </span>
                      {fecha(e.ultimoRegistro)}
                    </span>
                    <span className={`text-xs ${e.documentos ? "text-ink" : "text-red-700"}`}>
                      <span className="text-[11px] text-gray-500 sm:hidden print:hidden">Documentos: </span>
                      {e.documentos ? `${e.documentos} adjunto(s)` : "sin documento"}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
      ))}

      <footer className="hidden grid-cols-3 gap-8 pt-16 text-center text-xs text-gray-700 print:grid">
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
