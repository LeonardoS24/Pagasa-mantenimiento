import Link from "next/link";
import { requireUser, tieneEdicionAmpliada } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { CIUDADES_ALMACEN } from "@/lib/almacen";
import { pendienteDeCiudad } from "@/lib/almacen-servidor";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { AlmacenPanel } from "@/components/almacen/AlmacenPanel";

function dmy(fecha: Date | null, texto: string | null): string {
  if (!fecha) return texto ?? "—";
  return `${String(fecha.getUTCDate()).padStart(2, "0")}/${String(fecha.getUTCMonth() + 1).padStart(2, "0")}/${fecha.getUTCFullYear()}`;
}

// Inventario de almacén de la ciudad, llevado en una hoja de Google (ver
// lib/almacen.ts). Por ahora solo Hermosillo.
export default async function AlmacenPage({
  params,
  searchParams,
}: {
  params: { citySlug: string };
  searchParams: { q?: string };
}) {
  const user = await requireUser();
  const city = await assertCityAccess(user, params.citySlug);
  const migas = [{ label: "Inicio", href: "/dashboard" }, { label: city.name, href: `/ciudades/${city.slug}` }, { label: "Inventario de almacén" }];

  if (!CIUDADES_ALMACEN.includes(city.slug)) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={migas} />
        <h1 className="text-2xl font-semibold text-primary">Inventario de almacén</h1>
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-sm text-ink">
          Por ahora el inventario de almacén solo funciona en Hermosillo, que es de donde sale el inventario.
        </p>
      </div>
    );
  }

  const q = (searchParams.q ?? "").trim();
  const [config, pendiente, puede] = await Promise.all([
    prisma.almacenConfig.findUnique({ where: { cityId: city.id } }),
    pendienteDeCiudad(city.id),
    tieneEdicionAmpliada(user),
  ]);
  const articulos = await prisma.almacenArticulo.findMany({
    where: {
      cityId: city.id,
      activo: true,
      ...(q
        ? {
            OR: [
              { articulo: { contains: q } },
              { codigo: { contains: q } },
              { categoria: { contains: q } },
              { marca: { contains: q } },
              { ubicacion: { contains: q } },
              { prestadoA: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: [{ categoria: "asc" }, { articulo: "asc" }],
    take: 500,
  });
  const inactivos = await prisma.almacenArticulo.count({ where: { cityId: city.id, activo: false } });
  const movimientos = await prisma.almacenMovimiento.findMany({
    where: { cityId: city.id },
    orderBy: [{ fecha: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: { vehicleRecord: { select: { id: true, section: { select: { city: { select: { slug: true } } } } } } },
  });

  return (
    <div className="space-y-4">
      <Breadcrumb items={migas} />
      <h1 className="text-2xl font-semibold text-primary">Inventario de almacén</h1>
      <p className="text-sm text-ink">
        El inventario se lleva en la hoja de Google y el sistema lo sigue: lee la hoja, te muestra qué cambió y lo guarda cuando lo apruebas con tu contraseña. Nada
        se borra.
      </p>

      <AlmacenPanel
        citySlug={city.slug}
        puede={puede}
        urlHoja={config?.urlHoja ?? ""}
        ultimaLectura={config?.ultimaLectura?.toISOString() ?? null}
        ultimoError={config?.ultimoError ?? null}
        pendiente={
          pendiente
            ? {
                leidaEl: pendiente.lectura.leidaEl,
                avisos: pendiente.lectura.avisos,
                articulos: pendiente.dif.articulos,
                movimientos: pendiente.dif.movimientos,
                movimientosAusentes: pendiente.dif.movimientosAusentes,
                unidadesSinVincular: pendiente.dif.unidadesSinVincular,
              }
            : null
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 text-sm text-ink">
        <span>
          <b>«Unidad / Estación» desplegable:</b> descarga la lista de todas las unidades, estaciones y plantas del sistema y pégala en la pestaña «Listas» de
          la hoja cuando haya unidades nuevas.
        </span>
        <a
          href={`/api/ciudades/${city.slug}/almacen-unidades`}
          className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5"
        >
          Descargar lista de unidades
        </a>
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-primary">Inventario ({articulos.length})</h2>
          <form className="flex gap-2" action={`/ciudades/${city.slug}/almacen`}>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar artículo, código, ubicación…"
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
            />
            <button type="submit" className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary">
              Buscar
            </button>
          </form>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-ink">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Artículo</th>
                <th className="px-3 py-2">Categoría</th>
                <th className="px-3 py-2">Marca / Modelo</th>
                <th className="px-3 py-2">Unidad</th>
                <th className="px-3 py-2">Ubicación</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2 text-right">Disponibles</th>
                <th className="px-3 py-2">Prestado a</th>
                <th className="px-3 py-2">Notas</th>
              </tr>
            </thead>
            <tbody>
              {articulos.map((a) => (
                <tr key={a.id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2">{a.codigo ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{a.articulo}</td>
                  <td className="px-3 py-2">{a.categoria ?? "—"}</td>
                  <td className="px-3 py-2">{a.marca ?? "—"}</td>
                  <td className="px-3 py-2">{a.unidad ?? "—"}</td>
                  <td className="px-3 py-2">{a.ubicacion ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{a.cantidad ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{a.disponibles ?? "—"}</td>
                  <td className="px-3 py-2">{a.prestadoA ?? "—"}</td>
                  <td className="px-3 py-2">{a.notas ?? "—"}</td>
                </tr>
              ))}
              {articulos.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-ink">
                    {q ? "Nada coincide con esa búsqueda." : "Todavía no hay artículos. Conecta la hoja y aprueba la primera lectura."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {inactivos > 0 && <p className="text-xs text-ink">{inactivos} artículo(s) ya no aparecen en la hoja y están guardados como inactivos.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-primary">Últimos movimientos</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-ink">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Movimiento</th>
                <th className="px-3 py-2">Artículo</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                <th className="px-3 py-2">Trabajador</th>
                <th className="px-3 py-2">Unidad / Estación</th>
                <th className="px-3 py-2">Para qué / Dónde</th>
                <th className="px-3 py-2">Notas</th>
              </tr>
            </thead>
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2">{dmy(m.fecha, m.fechaTexto)}</td>
                  <td className="px-3 py-2">{m.movimiento ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{m.articulo}</td>
                  <td className="px-3 py-2 text-right">{m.cantidad ?? "—"}</td>
                  <td className="px-3 py-2">{m.trabajador ?? "—"}</td>
                  <td className="px-3 py-2">
                    {m.vehicleRecord ? (
                      <Link href={`/ciudades/${m.vehicleRecord.section.city.slug}/vehiculo/${m.vehicleRecord.id}`} className="text-primary underline">
                        {m.unidad}
                      </Link>
                    ) : (
                      (m.unidad ?? "—")
                    )}
                  </td>
                  <td className="px-3 py-2">{m.paraQue ?? "—"}</td>
                  <td className="px-3 py-2">{m.notas ?? "—"}</td>
                </tr>
              ))}
              {movimientos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-ink">
                    Todavía no hay movimientos guardados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
