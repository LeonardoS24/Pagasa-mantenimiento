import Link from "next/link";
import type { CSSProperties } from "react";
import type { EstadoRequisito, ElementoExpediente, ExpedienteUnidad } from "@/lib/expediente";
import { formatDate } from "@/lib/dates";

// Gráficas del expediente de cumplimiento (lib/expediente.ts). Reemplazan al
// checklist de cumplimiento que se marcaba a mano en cada unidad, estación y
// planta (el usuario pidió quitarlo el 9-nov-2026 y dejar solo la gráfica):
// aquí todo sale de las fechas y registros reales.
//
// Colores de estado fijos (nunca se usan para otra cosa) y siempre con su
// nombre en la leyenda y en el texto al pasar el mouse.

export const ESTADOS: { estado: EstadoRequisito; nombre: string; color: string }[] = [
  { estado: "vencido", nombre: "Vencido", color: "#d03b3b" },
  { estado: "porVencer", nombre: "Vence en 30 días o menos", color: "#fab219" },
  { estado: "vigente", nombre: "Al corriente", color: "#0ca30c" },
  { estado: "sinDato", nombre: "Sin fecha capturada", color: "#c3c2b7" },
];

export type Conteo = Record<EstadoRequisito, number>;

const vacio = (): Conteo => ({ vencido: 0, porVencer: 0, vigente: 0, sinDato: 0 });

// Suma los requisitos de varias unidades por ciudad o por requisito.
export function agruparPorCiudad(unidades: ExpedienteUnidad[]): { nombre: string; conteo: Conteo }[] {
  const mapa = new Map<string, Conteo>();
  for (const u of unidades) {
    const c = mapa.get(u.cityName) ?? vacio();
    for (const e of ESTADOS) c[e.estado] += u.conteo[e.estado];
    mapa.set(u.cityName, c);
  }
  return [...mapa.entries()].map(([nombre, conteo]) => ({ nombre, conteo }));
}

export function agruparPorRequisito(unidades: ExpedienteUnidad[]): { nombre: string; conteo: Conteo }[] {
  const mapa = new Map<string, Conteo>();
  for (const u of unidades) {
    for (const el of u.elementos) {
      const c = mapa.get(el.requisito) ?? vacio();
      c[el.estado]++;
      mapa.set(el.requisito, c);
    }
  }
  return [...mapa.entries()]
    .map(([nombre, conteo]) => ({ nombre, conteo }))
    .sort((a, b) => b.conteo.vencido - a.conteo.vencido || b.conteo.porVencer - a.conteo.porVencer || a.nombre.localeCompare(b.nombre, "es"));
}

function Leyenda() {
  return (
    <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-600">
      {ESTADOS.map((e) => (
        <li key={e.estado} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: e.color }} aria-hidden />
          {e.nombre}
        </li>
      ))}
    </ul>
  );
}

// Barras 100 % apiladas: una por ciudad o por requisito.
export function GraficaPorGrupo({
  titulo,
  grupos,
  unidad = "requisitos",
}: {
  titulo: string;
  grupos: { nombre: string; conteo: Conteo }[];
  unidad?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-2 text-sm font-semibold uppercase text-primary-bright">{titulo}</h2>
      <Leyenda />
      {grupos.length === 0 ? (
        <p className="text-sm text-gray-500">Todavía no hay datos para graficar.</p>
      ) : (
        <ul className="space-y-2.5">
          {grupos.map((g) => {
            const total = ESTADOS.reduce((s, e) => s + g.conteo[e.estado], 0);
            const conFecha = total - g.conteo.sinDato;
            return (
              <li key={g.nombre} className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[minmax(8rem,14rem)_1fr_auto] sm:gap-3">
                <span className="truncate text-sm text-ink" title={g.nombre}>
                  {g.nombre}
                </span>
                <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded bg-white" role="img" aria-label={resumen(g.nombre, g.conteo, unidad)}>
                  {total === 0 ? (
                    <div className="h-full w-full rounded bg-gray-100" />
                  ) : (
                    ESTADOS.filter((e) => g.conteo[e.estado] > 0).map((e) => (
                      <div
                        key={e.estado}
                        className="h-full first:rounded-l last:rounded-r"
                        style={{ width: `${(g.conteo[e.estado] / total) * 100}%`, background: e.color }}
                        title={`${g.nombre} — ${e.nombre}: ${g.conteo[e.estado]} de ${total} ${unidad}`}
                      />
                    ))
                  )}
                </div>
                <span className="whitespace-nowrap text-xs text-gray-600">
                  {conFecha > 0 ? `${Math.round((g.conteo.vigente / conFecha) * 100)} % al corriente` : "sin fechas"}
                  <span className="text-gray-400"> · {total}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-gray-500">
        «% al corriente» se cuenta sobre los {unidad} que sí tienen fecha; los que no la tienen van aparte en gris.
      </p>
    </div>
  );
}

function resumen(nombre: string, c: Conteo, unidad: string): string {
  return `${nombre}: ${ESTADOS.map((e) => `${c[e.estado]} ${e.nombre.toLowerCase()}`).join(", ")} (${unidad})`;
}

// Una unidad: cada requisito como barra desde «hoy» hacia su vencimiento.
// A la izquierda lo vencido (cuánto hace), a la derecha lo que falta.
export function GraficaDeUnidad({ elementos, enlaceExpediente }: { elementos: ElementoExpediente[]; enlaceExpediente: string }) {
  const conFecha = elementos.filter((e) => e.dias !== null);
  const maxAtras = Math.max(30, ...conFecha.map((e) => (e.dias! < 0 ? -e.dias! : 0)));
  const maxAdelante = Math.max(30, ...conFecha.map((e) => (e.dias! > 0 ? e.dias! : 0)));
  // Lo vencido ocupa a lo más un tercio del ancho para que se lea lo que falta.
  const hayVencidos = conFecha.some((e) => e.dias! < 0);
  const fraccionAtras = hayVencidos ? Math.min(0.35, Math.max(0.2, maxAtras / (maxAtras + maxAdelante))) : 0;
  const color = (estado: EstadoRequisito) => ESTADOS.find((x) => x.estado === estado)!.color;
  const texto = (e: ElementoExpediente) =>
    e.dias === null
      ? "Sin fecha capturada"
      : e.dias < 0
        ? `Vencido el ${formatDate(e.vence)} (hace ${-e.dias} días)`
        : e.dias === 0
          ? `Vence hoy`
          : `Vence el ${formatDate(e.vence)} (en ${e.dias} días)`;

  return (
    <div>
      <Leyenda />
      {elementos.length === 0 ? (
        <p className="text-sm text-gray-500">Este registro no tiene requisitos con fecha en el expediente.</p>
      ) : (
        <ul className="space-y-2">
          {elementos.map((e) => {
            const d = e.dias;
            const izquierda = fraccionAtras * 100;
            let estilo: CSSProperties | null = null;
            if (d !== null && d < 0) {
              const w = (Math.min(-d, maxAtras) / maxAtras) * izquierda;
              estilo = { left: `${izquierda - w}%`, width: `${Math.max(w, 1)}%` };
            } else if (d !== null) {
              const w = (d / maxAdelante) * (100 - izquierda);
              estilo = { left: `${izquierda}%`, width: `${Math.max(w, 1)}%` };
            }
            return (
              <li key={e.clave} className="grid grid-cols-1 items-center gap-1 sm:grid-cols-[minmax(8rem,16rem)_1fr] sm:gap-3">
                <span className="text-sm text-ink" title={e.fundamento}>
                  {e.requisito}
                  {e.detalle && <span className="text-gray-500"> · {e.detalle}</span>}
                </span>
                <div className="relative h-6" title={`${e.requisito}: ${texto(e)}`}>
                  {/* Línea de «hoy» */}
                  {hayVencidos && <div className="absolute inset-y-0 w-px bg-gray-400" style={{ left: `${izquierda}%` }} aria-hidden />}
                  {estilo ? (
                    <div className="absolute top-1 h-4 rounded" style={{ ...estilo, background: color(e.estado) }} />
                  ) : (
                    <div className="absolute inset-y-1 left-0 right-0 rounded border border-dashed border-gray-300" />
                  )}
                  <span
                    className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-white/90 px-1 text-xs text-gray-700"
                    style={
                      estilo && d !== null && d >= 0 && (d / maxAdelante) < 0.55
                        ? { left: `calc(${estilo.left} + ${estilo.width} + 6px)` }
                        : { right: "4px" }
                    }
                  >
                    {texto(e)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
        <span>{hayVencidos ? "La línea gris es hoy: a la izquierda lo vencido, a la derecha lo que falta." : "Cada barra es lo que falta para su vencimiento."}</span>
        <Link href={enlaceExpediente} className="font-medium text-primary hover:underline">
          Ver el expediente completo →
        </Link>
      </div>
    </div>
  );
}
