import { prisma } from "@/lib/prisma";
import {
  TIPOS_VENCIMIENTO,
  getVencimientos,
  type TipoVencimiento,
  type Vencimiento,
} from "@/lib/vencimientos";

// Datos del tablero de cumplimiento (/ciudades/[citySlug]/tablero): de cada
// unidad activa, qué tan al corriente está, a partir de sus vencimientos con
// fecha (lib/vencimientos.ts, la misma fuente que alertas y calendario).
//
// Estado de una unidad = el peor de sus vencimientos:
//   vencido  → alguno ya pasó
//   urgente  → alguno vence en 7 días o menos
//   proximo  → alguno vence en 8 a 30 días
//   alCorriente → todos a más de 30 días
//   sinFechas → no tiene ninguna fecha capturada (no se puede saber)
export type EstadoUnidad = "vencido" | "urgente" | "proximo" | "alCorriente" | "sinFechas";

export type UnidadBase = {
  id: string;
  numeroEconomico: string;
  sectionSlug: string;
  sectionName: string;
  citySlug: string;
  cityName: string;
};

export type Conteo = Record<EstadoUnidad, number> & { total: number };

export type FilaTablero = { clave: string; nombre: string; conteo: Conteo; porcentaje: number | null };

export type UnidadAtencion = UnidadBase & {
  estado: EstadoUnidad;
  vencidos: number;
  proximos: number;
  peor: Vencimiento;
};

export type Tablero = {
  conteo: Conteo;
  // % de las unidades con fechas que están al corriente (nada vencido ni a 30 días).
  porcentajeAlCorriente: number | null;
  porCiudad: FilaTablero[];
  porApartado: FilaTablero[];
  porTipo: { tipo: TipoVencimiento; nombre: string; vencidos: number; proximos30: number; total: number }[];
  // Vencimientos que caen en cada uno de los próximos 6 meses.
  proximosMeses: { etiqueta: string; total: number; urgentes: number }[];
  atencion: UnidadAtencion[];
};

const vacio = (): Conteo => ({ vencido: 0, urgente: 0, proximo: 0, alCorriente: 0, sinFechas: 0, total: 0 });

function estadoDe(lista: Vencimiento[]): EstadoUnidad {
  if (lista.length === 0) return "sinFechas";
  const minimo = Math.min(...lista.map((v) => v.dias));
  if (minimo < 0) return "vencido";
  if (minimo <= 7) return "urgente";
  if (minimo <= 30) return "proximo";
  return "alCorriente";
}

// Porcentaje de las unidades con fechas que están al corriente.
export function porcentajeDe(c: Conteo): number | null {
  const conFechas = c.total - c.sinFechas;
  return conFechas === 0 ? null : Math.round((c.alCorriente / conFechas) * 100);
}

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Función pura (sin base de datos) para poder probarla con datos inventados.
export function armarTablero(unidades: UnidadBase[], vencimientos: Vencimiento[], hoy: Date = new Date()): Tablero {
  const porUnidad = new Map<string, Vencimiento[]>();
  for (const v of vencimientos) porUnidad.set(v.vehicleId, [...(porUnidad.get(v.vehicleId) ?? []), v]);

  const conteo = vacio();
  const ciudades = new Map<string, { nombre: string; conteo: Conteo }>();
  const apartados = new Map<string, { nombre: string; conteo: Conteo }>();
  const atencion: UnidadAtencion[] = [];

  for (const u of unidades) {
    const lista = porUnidad.get(u.id) ?? [];
    const estado = estadoDe(lista);
    const ciudad = ciudades.get(u.citySlug) ?? { nombre: u.cityName, conteo: vacio() };
    const apartado = apartados.get(u.sectionSlug) ?? { nombre: u.sectionName, conteo: vacio() };
    for (const c of [conteo, ciudad.conteo, apartado.conteo]) {
      c[estado]++;
      c.total++;
    }
    ciudades.set(u.citySlug, ciudad);
    apartados.set(u.sectionSlug, apartado);

    if (estado === "vencido" || estado === "urgente" || estado === "proximo") {
      const peor = [...lista].sort((a, b) => a.dias - b.dias)[0];
      atencion.push({
        ...u,
        estado,
        vencidos: lista.filter((v) => v.dias < 0).length,
        proximos: lista.filter((v) => v.dias >= 0 && v.dias <= 30).length,
        peor,
      });
    }
  }

  const orden = { vencido: 0, urgente: 1, proximo: 2, alCorriente: 3, sinFechas: 4 };
  atencion.sort(
    (a, b) => orden[a.estado] - orden[b.estado] || b.vencidos - a.vencidos || a.peor.dias - b.peor.dias
  );

  const filas = (m: Map<string, { nombre: string; conteo: Conteo }>): FilaTablero[] =>
    [...m.entries()]
      .map(([clave, { nombre, conteo }]) => ({ clave, nombre, conteo, porcentaje: porcentajeDe(conteo) }))
      .sort((a, b) => (a.porcentaje ?? 101) - (b.porcentaje ?? 101) || a.nombre.localeCompare(b.nombre, "es"));

  const porTipo = TIPOS_VENCIMIENTO.map(({ tipo, nombre }) => {
    const lista = vencimientos.filter((v) => v.tipo === tipo);
    return {
      tipo,
      nombre,
      vencidos: lista.filter((v) => v.dias < 0).length,
      proximos30: lista.filter((v) => v.dias >= 0 && v.dias <= 30).length,
      total: lista.length,
    };
  }).filter((t) => t.total > 0);

  const proximosMeses = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth() + i, 1));
    const delMes = vencimientos.filter(
      (v) => v.fecha.getUTCFullYear() === d.getUTCFullYear() && v.fecha.getUTCMonth() === d.getUTCMonth() && v.dias >= 0
    );
    return {
      etiqueta: `${MESES_CORTOS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`,
      total: delMes.length,
      urgentes: delMes.filter((v) => v.dias <= 30).length,
    };
  });

  return {
    conteo,
    porcentajeAlCorriente: porcentajeDe(conteo),
    porCiudad: filas(ciudades),
    porApartado: filas(apartados),
    porTipo,
    proximosMeses,
    atencion,
  };
}

export async function getTablero(cityIds: string[]): Promise<Tablero> {
  const registros = await prisma.vehicleRecord.findMany({
    where: { activo: true, section: { cityId: { in: cityIds } } },
    select: {
      id: true,
      numeroEconomico: true,
      section: { select: { slug: true, name: true, city: { select: { slug: true, name: true } } } },
    },
  });
  const unidades: UnidadBase[] = registros.map((r) => ({
    id: r.id,
    numeroEconomico: r.numeroEconomico,
    sectionSlug: r.section.slug,
    sectionName: r.section.name,
    citySlug: r.section.city.slug,
    cityName: r.section.city.name,
  }));
  return armarTablero(unidades, await getVencimientos(cityIds));
}
