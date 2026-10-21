import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { isAggregateCitySlug, getAllRealCityIds } from "@/lib/aggregate-city";
import { prisma } from "@/lib/prisma";
import { getUrlBase } from "@/lib/ajustes";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { ImprimirEtiquetasButton } from "@/components/city/ImprimirEtiquetasButton";

// Etiquetas con código QR para pegar en cada unidad, estación o planta: al
// escanearlas con el celular abre la ficha de esa unidad (si no ha iniciado
// sesión, pide usuario y contraseña y regresa a la ficha; ver
// lib/ruta-segura.ts). Solo lectura: basta con poder ver la ciudad.
export default async function EtiquetasQrPage({
  params,
  searchParams,
}: {
  params: { citySlug: string };
  searchParams: { apartado?: string; unidad?: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const city = await assertCityAccess(user, params.citySlug);

  const esAgregada = isAggregateCitySlug(city.slug);
  const cityIds = esAgregada ? await getAllRealCityIds() : [city.id];

  const registros = await prisma.vehicleRecord.findMany({
    where: {
      activo: true,
      section: { cityId: { in: cityIds } },
      ...(searchParams.unidad ? { id: searchParams.unidad } : {}),
    },
    select: {
      id: true,
      numeroEconomico: true,
      section: { select: { slug: true, name: true, order: true, city: { select: { slug: true, name: true } } } },
    },
  });
  const apartados = [...new Map(registros.map((r) => [r.section.slug, r.section.name])).entries()].sort((a, b) =>
    a[1].localeCompare(b[1], "es")
  );
  const filtrados = registros
    .filter((r) => !searchParams.apartado || r.section.slug === searchParams.apartado)
    .sort(
      (a, b) =>
        a.section.city.name.localeCompare(b.section.city.name, "es") ||
        a.section.name.localeCompare(b.section.name, "es") ||
        a.numeroEconomico.localeCompare(b.numeroEconomico, "es", { numeric: true })
    );

  // Dirección con la que los celulares abren el sistema. Sin la configurada
  // en el panel, se usa la de esta misma página, que desde la computadora del
  // servidor suele ser "localhost" y no sirve en un celular.
  const configurada = await getUrlBase();
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost";
  const protocolo = h.get("x-forwarded-proto") ?? "http";
  const urlBase = configurada ?? `${protocolo}://${host}`;
  const urlSospechosa = !configurada && /^(localhost|127\.|\[::1\])/.test(host);

  const etiquetas = await Promise.all(
    filtrados.map(async (r) => {
      const url = `${urlBase}/ciudades/${r.section.city.slug}/vehiculo/${r.id}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
      return { ...r, svg };
    })
  );

  return (
    <div>
      <div className="print:hidden">
        <Breadcrumb
          items={[
            { label: "Inicio", href: "/dashboard" },
            { label: city.name, href: `/ciudades/${city.slug}` },
            { label: "Etiquetas QR" },
          ]}
        />
        <div className="mb-4">
          <h1 className="text-2xl font-semibold text-primary">Etiquetas QR</h1>
          <p className="mt-1 text-sm text-ink">
            Imprime la etiqueta de cada unidad y pégala en ella: al escanearla con el celular se abre su ficha en el sistema
            (pide usuario y contraseña si no se ha iniciado sesión).
          </p>
        </div>

        {urlSospechosa && (
          <p className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm text-yellow-900">
            Los códigos apuntan a <strong>{urlBase}</strong>, que un celular no puede abrir. Captura la dirección real del
            sistema (por ejemplo http://192.168.1.50:3000) en{" "}
            {user.role === "ADMIN" ? (
              <Link href="/admin/reportes" className="underline">Panel de administración → Reportes por correo → Dirección del sistema</Link>
            ) : (
              "el panel de administración (pídeselo al administrador)"
            )}{" "}
            y vuelve a abrir esta página.
          </p>
        )}
        {configurada && (
          <p className="mb-4 text-xs text-gray-500">Los códigos apuntan a {configurada}.</p>
        )}

        <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
          <label className="text-sm text-ink">
            <span className="mb-1 block font-medium">Apartado</span>
            <select name="apartado" defaultValue={searchParams.apartado ?? ""} className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm">
              <option value="">Todos</option>
              {apartados.map(([slug, nombre]) => (
                <option key={slug} value={slug}>{nombre}</option>
              ))}
            </select>
          </label>
          {searchParams.unidad && <input type="hidden" name="unidad" value={searchParams.unidad} />}
          <button type="submit" className="rounded-md border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5">
            Filtrar
          </button>
          <span className="py-2 text-sm text-gray-500">{etiquetas.length} etiqueta(s)</span>
          <div className="ml-auto">
            <ImprimirEtiquetasButton />
          </div>
        </form>
      </div>

      {etiquetas.length === 0 ? (
        <p className="text-sm text-gray-500">No hay unidades activas con ese filtro.</p>
      ) : (
        <div className="grid gap-3 print:gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, 6.2cm)" }}>
          {etiquetas.map((e) => (
            <div
              key={e.id}
              className="flex flex-col items-center rounded-md border border-gray-400 bg-white p-2 text-center"
              style={{ width: "6.2cm", breakInside: "avoid", pageBreakInside: "avoid" }}
            >
              <div className="w-full text-[9px] font-semibold uppercase tracking-wide text-primary">Grupo Pagasa</div>
              <div
                className="my-1 [&>svg]:h-full [&>svg]:w-full"
                style={{ width: "3.6cm", height: "3.6cm" }}
                aria-label={`Código QR de ${e.numeroEconomico}`}
                dangerouslySetInnerHTML={{ __html: e.svg }}
              />
              <div className="w-full break-words text-base font-bold leading-tight text-black">{e.numeroEconomico}</div>
              <div className="w-full text-[10px] leading-tight text-gray-700">
                {e.section.name}
                {esAgregada ? ` · ${e.section.city.name}` : ""}
              </div>
              <div className="mt-1 text-[8px] text-gray-500">Escanea para ver la ficha</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
