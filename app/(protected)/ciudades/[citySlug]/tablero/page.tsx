import Link from "next/link";
import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { isAggregateCitySlug, getAllRealCityIds } from "@/lib/aggregate-city";
import { getTablero, type FilaTablero } from "@/lib/tablero";
import { formatDate } from "@/lib/dates";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { BarraEstados, LeyendaEstados } from "@/components/city/BarraEstados";

// Tablero de cumplimiento: qué tan al día están las unidades, estaciones y
// planta con sus pruebas, inspecciones, mantenimientos, válvulas, mangueras y
// pólizas. Sale de los mismos vencimientos que las alertas y el calendario
// (lib/vencimientos.ts). Solo lectura: basta con poder ver la ciudad.
export default async function TableroPage({ params }: { params: { citySlug: string } }) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const city = await assertCityAccess(user, params.citySlug);

  const esAgregada = isAggregateCitySlug(city.slug);
  const cityIds = esAgregada ? await getAllRealCityIds() : [city.id];
  const t = await getTablero(cityIds);
  const c = t.conteo;
  const maxMes = Math.max(1, ...t.proximosMeses.map((m) => m.total));
  const pct = t.porcentajeAlCorriente;
  const colorPct = pct === null ? "text-gray-500" : pct >= 80 ? "text-green-700" : pct >= 50 ? "text-yellow-700" : "text-red-700";

  const Tabla = ({ titulo, filas, nota }: { titulo: string; filas: FilaTablero[]; nota?: string }) => (
    <section className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase text-primary-bright">{titulo}</h2>
      {nota && <p className="mb-3 text-xs text-gray-500">{nota}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="py-1 pr-3 font-medium">Nombre</th>
              <th className="w-1/3 py-1 pr-3 font-medium">Estado de las unidades</th>
              <th className="py-1 pr-3 text-right font-medium">Unidades</th>
              <th className="py-1 pr-3 text-right font-medium">Con vencidos</th>
              <th className="py-1 text-right font-medium">Al corriente</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.clave} className="border-t border-gray-100">
                <td className="py-2 pr-3 font-medium text-ink">{f.nombre}</td>
                <td className="py-2 pr-3">
                  <BarraEstados conteo={f.conteo} etiqueta={f.nombre} />
                </td>
                <td className="py-2 pr-3 text-right">{f.conteo.total}</td>
                <td className={`py-2 pr-3 text-right ${f.conteo.vencido ? "font-semibold text-red-700" : "text-gray-500"}`}>{f.conteo.vencido}</td>
                <td className="py-2 text-right font-semibold">{f.porcentaje === null ? "—" : `${f.porcentaje}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Inicio", href: "/dashboard" },
          { label: city.name, href: `/ciudades/${city.slug}` },
          { label: "Tablero de cumplimiento" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">Tablero de cumplimiento</h1>
        <p className="mt-1 text-sm text-ink">
          Qué tan al día están las unidades{esAgregada ? " de todas las ciudades" : ` de ${city.name}`}. Una unidad está{" "}
          <strong>al corriente</strong> cuando ninguno de sus vencimientos con fecha ha pasado ni vence en los próximos 30
          días. Las unidades sin ninguna fecha capturada no cuentan en el porcentaje: no se puede saber.{" "}
          <Link href={`/ciudades/${city.slug}/calendario`} className="text-primary underline">Ver el calendario</Link>.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <div className="col-span-2 rounded-lg border border-gray-200 bg-white p-4">
          <p className={`text-4xl font-semibold ${colorPct}`}>{pct === null ? "—" : `${pct}%`}</p>
          <p className="text-sm text-ink">de las unidades al corriente</p>
        </div>
        {[
          ["Unidades activas", c.total, "text-ink"],
          ["Con vencidos", c.vencido, c.vencido ? "text-red-700" : "text-ink"],
          ["Vencen en 30 días", c.urgente + c.proximo, c.urgente + c.proximo ? "text-yellow-700" : "text-ink"],
          ["Sin fechas capturadas", c.sinFechas, "text-gray-600"],
        ].map(([titulo, valor, color]) => (
          <div key={titulo as string} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className={`text-3xl font-semibold ${color}`}>{valor}</p>
            <p className="text-sm text-ink">{titulo}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <LeyendaEstados />
      </div>

      <div className="space-y-6">
        {esAgregada && t.porCiudad.length > 0 && (
          <Tabla titulo="Cumplimiento por ciudad" filas={t.porCiudad} nota="Ordenado de la que menos cumple a la que más." />
        )}
        <Tabla titulo="Cumplimiento por apartado" filas={t.porApartado} />

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Por tipo de vencimiento</h2>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-gray-500">
                  <th className="py-1 font-medium">Tipo</th>
                  <th className="py-1 text-right font-medium">Vencidos</th>
                  <th className="py-1 text-right font-medium">En 30 días</th>
                  <th className="py-1 text-right font-medium">Con fecha</th>
                </tr>
              </thead>
              <tbody>
                {t.porTipo.map((x) => (
                  <tr key={x.tipo} className="border-t border-gray-100">
                    <td className="py-1.5 text-ink">{x.nombre}</td>
                    <td className={`py-1.5 text-right ${x.vencidos ? "font-semibold text-red-700" : "text-gray-500"}`}>{x.vencidos}</td>
                    <td className={`py-1.5 text-right ${x.proximos30 ? "font-semibold text-yellow-700" : "text-gray-500"}`}>{x.proximos30}</td>
                    <td className="py-1.5 text-right text-gray-600">{x.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-1 text-sm font-semibold uppercase text-primary-bright">Lo que vence en los próximos 6 meses</h2>
            <p className="mb-3 text-xs text-gray-500">Barra oscura: lo que vence en 30 días o menos.</p>
            <ul className="space-y-2">
              {t.proximosMeses.map((m) => (
                <li key={m.etiqueta} className="flex items-center gap-3 text-sm">
                  <span className="w-14 shrink-0 capitalize text-gray-600">{m.etiqueta}</span>
                  <div className="relative h-4 flex-1 rounded bg-gray-100" role="img" aria-label={`${m.etiqueta}: ${m.total} vencimientos`}>
                    <div className="absolute inset-y-0 left-0 rounded bg-primary/30" style={{ width: `${(m.total / maxMes) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded bg-primary" style={{ width: `${(m.urgentes / maxMes) * 100}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right font-semibold text-ink">{m.total}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase text-primary-bright">Unidades que requieren atención</h2>
          <p className="mb-3 text-xs text-gray-500">Primero las que tienen más vencidos. Se muestran hasta 25.</p>
          {t.atencion.length === 0 ? (
            <p className="text-sm text-gray-500">Ninguna unidad tiene vencimientos pendientes ni en los próximos 30 días.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {t.atencion.slice(0, 25).map((u) => (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
                  <span
                    className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${
                      u.estado === "vencido"
                        ? "border-red-300 bg-red-100 text-red-800"
                        : u.estado === "urgente"
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-yellow-300 bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {u.vencidos > 0 ? `${u.vencidos} vencido(s)` : u.estado === "urgente" ? "Vence pronto" : "Próximo"}
                  </span>
                  <Link href={`/ciudades/${u.citySlug}/vehiculo/${u.id}`} className="font-medium text-primary hover:underline">
                    {u.numeroEconomico}
                  </Link>
                  <span className="text-gray-500">
                    {u.sectionName}
                    {esAgregada ? ` · ${u.cityName}` : ""}
                  </span>
                  <span className="text-ink">
                    {u.peor.tipoNombre}
                    {u.peor.detalle ? ` · ${u.peor.detalle}` : ""}
                  </span>
                  <span className="ml-auto text-gray-500">{formatDate(u.peor.fecha)}</span>
                </li>
              ))}
            </ul>
          )}
          {t.atencion.length > 25 && (
            <p className="mt-3 text-xs text-gray-500">
              Y {t.atencion.length - 25} más. Revisa todo en el{" "}
              <Link href={`/ciudades/${city.slug}/calendario`} className="text-primary underline">calendario</Link>.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
