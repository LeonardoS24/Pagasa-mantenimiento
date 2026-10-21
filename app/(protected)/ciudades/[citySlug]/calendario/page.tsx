import Link from "next/link";
import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { isAggregateCitySlug, getAllRealCityIds } from "@/lib/aggregate-city";
import { prisma } from "@/lib/prisma";
import {
  TIPOS_VENCIMIENTO,
  diaISO,
  getVencimientos,
  type NivelVencimiento,
  type TipoVencimiento,
  type Vencimiento,
} from "@/lib/vencimientos";
import { formatDate } from "@/lib/dates";
import { Breadcrumb } from "@/components/layout/Breadcrumb";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const ESTILO_NIVEL: Record<NivelVencimiento, string> = {
  red: "bg-red-100 text-red-800 border-red-300",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-300",
  ok: "bg-primary/10 text-primary border-primary/20",
};
const ESTILO_FILA: Record<NivelVencimiento, string> = {
  red: "bg-red-50",
  yellow: "bg-yellow-50",
  ok: "",
};

function textoDias(dias: number): string {
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día(s)`;
  if (dias === 0) return "Vence hoy";
  return `Faltan ${dias} día(s)`;
}

// AAAA-MM del parámetro; si viene mal o vacío, el mes en curso.
function mesDeParametro(valor: string | undefined): { anio: number; mes: number } {
  const m = valor?.match(/^(\d{4})-(\d{2})$/);
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12 && Number(m[1]) >= 2000 && Number(m[1]) <= 2100) {
    return { anio: Number(m[1]), mes: Number(m[2]) - 1 };
  }
  const hoy = new Date();
  return { anio: hoy.getFullYear(), mes: hoy.getMonth() };
}

function claveMes(anio: number, mes: number): string {
  const d = new Date(Date.UTC(anio, mes, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function peor(niveles: NivelVencimiento[]): NivelVencimiento {
  if (niveles.includes("red")) return "red";
  if (niveles.includes("yellow")) return "yellow";
  return "ok";
}

export default async function CalendarioPage({
  params,
  searchParams,
}: {
  params: { citySlug: string };
  searchParams: { mes?: string; tipo?: string; ciudad?: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const city = await assertCityAccess(user, params.citySlug);

  const esAgregada = isAggregateCitySlug(city.slug);
  const cityIds = esAgregada ? await getAllRealCityIds() : [city.id];
  const ciudades = esAgregada
    ? await prisma.city.findMany({ where: { id: { in: cityIds } }, select: { slug: true, name: true }, orderBy: { name: "asc" } })
    : [];

  const todos = await getVencimientos(cityIds);
  const tipoFiltro = TIPOS_VENCIMIENTO.find((t) => t.tipo === searchParams.tipo)?.tipo as TipoVencimiento | undefined;
  const ciudadFiltro = ciudades.find((c) => c.slug === searchParams.ciudad)?.slug;
  const vencimientos = todos.filter(
    (v) => (!tipoFiltro || v.tipo === tipoFiltro) && (!ciudadFiltro || v.citySlug === ciudadFiltro)
  );

  const { anio, mes } = mesDeParametro(searchParams.mes);
  const consulta = (extra: Record<string, string>) => {
    const q = new URLSearchParams();
    if (tipoFiltro) q.set("tipo", tipoFiltro);
    if (ciudadFiltro) q.set("ciudad", ciudadFiltro);
    for (const [k, v] of Object.entries(extra)) q.set(k, v);
    return `/ciudades/${city.slug}/calendario?${q.toString()}`;
  };

  // Resumen
  const vencidos = vencimientos.filter((v) => v.dias < 0);
  const en7 = vencimientos.filter((v) => v.dias >= 0 && v.dias <= 7);
  const en30 = vencimientos.filter((v) => v.dias > 7 && v.dias <= 30);
  const en90 = vencimientos.filter((v) => v.dias > 30 && v.dias <= 90);

  // Mes que se muestra
  const delMes = vencimientos.filter((v) => {
    const f = v.fecha;
    return f.getUTCFullYear() === anio && f.getUTCMonth() === mes;
  });
  const porDia = new Map<string, Vencimiento[]>();
  for (const v of delMes) {
    const k = diaISO(v.fecha);
    porDia.set(k, [...(porDia.get(k) ?? []), v]);
  }
  const diasDelMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  const huecosAntes = (new Date(Date.UTC(anio, mes, 1)).getUTCDay() + 6) % 7; // lunes primero
  const hoy = new Date();
  const hoyISO = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;

  const tarjetas: { titulo: string; lista: Vencimiento[]; nivel: NivelVencimiento }[] = [
    { titulo: "Vencidos", lista: vencidos, nivel: "red" },
    { titulo: "Próximos 7 días", lista: en7, nivel: "red" },
    { titulo: "De 8 a 30 días", lista: en30, nivel: "yellow" },
    { titulo: "De 31 a 90 días", lista: en90, nivel: "ok" },
  ];

  return (
    <div>
      <Breadcrumb
        items={[
          { label: "Inicio", href: "/dashboard" },
          { label: city.name, href: `/ciudades/${city.slug}` },
          { label: "Calendario de vencimientos" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-primary">Calendario de vencimientos</h1>
        <p className="mt-1 text-sm text-ink">
          Pruebas, inspecciones, mantenimientos, válvulas, mangueras y pólizas con fecha
          {esAgregada ? " de todas las ciudades" : ` de ${city.name}`}, en un solo lugar. Los plazos son los de{" "}
          <Link href="/admin/normas" className="text-primary underline">Normas y plazos</Link>.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <div key={t.titulo} className={`rounded-lg border p-4 ${ESTILO_NIVEL[t.nivel]}`}>
            <p className="text-3xl font-semibold">{t.lista.length}</p>
            <p className="text-sm">{t.titulo}</p>
          </div>
        ))}
      </div>

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <input type="hidden" name="mes" value={claveMes(anio, mes)} />
        <label className="text-sm text-ink">
          <span className="mb-1 block font-medium">Tipo</span>
          <select name="tipo" defaultValue={tipoFiltro ?? ""} className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm">
            <option value="">Todos</option>
            {TIPOS_VENCIMIENTO.map((t) => (
              <option key={t.tipo} value={t.tipo}>{t.nombre}</option>
            ))}
          </select>
        </label>
        {esAgregada && (
          <label className="text-sm text-ink">
            <span className="mb-1 block font-medium">Ciudad</span>
            <select name="ciudad" defaultValue={ciudadFiltro ?? ""} className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm">
              <option value="">Todas</option>
              {ciudades.map((c) => (
                <option key={c.slug} value={c.slug}>{c.name}</option>
              ))}
            </select>
          </label>
        )}
        <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
          Filtrar
        </button>
        {(tipoFiltro || ciudadFiltro) && (
          <Link href={`/ciudades/${city.slug}/calendario?mes=${claveMes(anio, mes)}`} className="py-2 text-sm text-primary underline">
            Quitar filtros
          </Link>
        )}
        <a
          href={`/api/ciudades/${city.slug}/calendario?${new URLSearchParams({
            ...(tipoFiltro ? { tipo: tipoFiltro } : {}),
            ...(ciudadFiltro ? { ciudad: ciudadFiltro } : {}),
          }).toString()}`}
          className="ml-auto py-2 text-sm text-primary underline"
        >
          Descargar para Outlook / Google Calendar (.ics)
        </a>
      </form>

      {vencidos.length > 0 && (
        <details open className="mb-6 rounded-lg border border-red-200 bg-white">
          <summary className="cursor-pointer rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
            Vencidos ({vencidos.length})
          </summary>
          <ListaVencimientos lista={[...vencidos].reverse()} mostrarCiudad={esAgregada} />
        </details>
      )}

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link href={consulta({ mes: claveMes(anio, mes - 1) })} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary hover:bg-primary/5">
            ← Mes anterior
          </Link>
          <h2 className="text-lg font-semibold capitalize text-primary">
            {MESES[mes]} {anio}
          </h2>
          <div className="flex gap-2">
            <Link href={consulta({})} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary hover:bg-primary/5">
              Hoy
            </Link>
            <Link href={consulta({ mes: claveMes(anio, mes + 1) })} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-primary hover:bg-primary/5">
              Mes siguiente →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-gray-500">
          {DIAS_SEMANA.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: huecosAntes }).map((_, i) => (
            <div key={`h${i}`} />
          ))}
          {Array.from({ length: diasDelMes }).map((_, i) => {
            const dia = i + 1;
            const iso = `${claveMes(anio, mes)}-${String(dia).padStart(2, "0")}`;
            const eventos = porDia.get(iso) ?? [];
            const nivel = eventos.length ? peor(eventos.map((e) => e.nivel)) : null;
            const esHoy = iso === hoyISO;
            const celda = (
              <>
                <span className={esHoy ? "rounded bg-primary px-1 text-white" : ""}>{dia}</span>
                {nivel && (
                  <span className={`mt-1 block rounded border px-1 text-[11px] font-semibold ${ESTILO_NIVEL[nivel]}`}>
                    {eventos.length}
                  </span>
                )}
              </>
            );
            const clases = `min-h-[3.25rem] rounded-md border p-1 text-left text-xs sm:min-h-[4.25rem] sm:p-1.5 sm:text-sm ${
              esHoy ? "border-primary" : "border-gray-200"
            }`;
            return eventos.length ? (
              <a key={iso} href={`#dia-${iso}`} className={`${clases} hover:bg-gray-50`}>
                {celda}
              </a>
            ) : (
              <div key={iso} className={`${clases} text-gray-500`}>
                {celda}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white">
        <h2 className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-primary">
          Vencimientos de {MESES[mes]} {anio} ({delMes.length})
        </h2>
        {delMes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No hay vencimientos este mes con los filtros elegidos.</p>
        ) : (
          [...porDia.entries()].map(([iso, lista]) => (
            <div key={iso} id={`dia-${iso}`} className="scroll-mt-24 border-b border-gray-100 last:border-b-0">
              <p className="bg-gray-50 px-4 py-2 text-sm font-medium text-ink">{formatDate(new Date(iso))}</p>
              <ListaVencimientos lista={lista} mostrarCiudad={esAgregada} />
            </div>
          ))
        )}
      </section>

      <p className="mt-4 text-xs text-gray-500">
        No incluye extintores: su alerta es por estado (calidad mala), no por una fecha de vencimiento.
      </p>
    </div>
  );
}

function ListaVencimientos({ lista, mostrarCiudad }: { lista: Vencimiento[]; mostrarCiudad: boolean }) {
  return (
    <ul className="divide-y divide-gray-100">
      {lista.map((v) => (
        <li key={v.clave} className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm ${ESTILO_FILA[v.nivel]}`}>
          <span className={`inline-block rounded border px-2 py-0.5 text-xs font-medium ${ESTILO_NIVEL[v.nivel]}`}>
            {textoDias(v.dias)}
          </span>
          <Link href={`/ciudades/${v.citySlug}/vehiculo/${v.vehicleId}`} className="font-medium text-primary hover:underline">
            {v.numeroEconomico}
          </Link>
          <span className="text-ink">
            {v.tipoNombre}
            {v.detalle ? ` · ${v.detalle}` : ""}
          </span>
          <span className="text-gray-500">{v.sectionName}{mostrarCiudad ? ` · ${v.cityName}` : ""}</span>
          <span className="ml-auto text-gray-500">{formatDate(v.fecha)}</span>
        </li>
      ))}
    </ul>
  );
}
