import { prisma } from "./prisma";
import { TRACTOCAMIONES_SLUG, SEMIRREMOLQUES_SLUG } from "./kino-sections";

// Datos para ver Tractocamiones y Semirremolques de Transportadora Kino
// agrupados por conjunto (tractocamión + sus semirremolques, como en los
// dictámenes; ver ConjuntoTransporte en el schema).

const unidadSelect = {
  id: true,
  numeroEconomico: true,
  sucursal: true,
  anio: true,
  placas: true,
  activo: true,
  section: { select: { slug: true } },
  technicalSheet: {
    select: {
      serie: true,
      numeroPemex: true,
      capacidadTanque: true,
      numeroUltimoUltrasonido: true,
      fechaProximoUltrasonido: true,
    },
  },
} as const;

export type UnidadConjunto = {
  id: string;
  numeroEconomico: string;
  marca: string;
  anio: string | null;
  placas: string | null;
  activo: boolean;
  esTractocamion: boolean;
  serie: string | null;
  numeroPemex: string | null;
  capacidad: string | null;
  numeroUltrasonido: string | null;
  proximoUltrasonido: Date | null;
};

export type ConjuntoVista = {
  id: string;
  nombre: string;
  observaciones: string | null;
  tractocamion: UnidadConjunto | null;
  semirremolques: UnidadConjunto[];
};

type Fila = {
  id: string;
  numeroEconomico: string;
  sucursal: string;
  anio: string | null;
  placas: string | null;
  activo: boolean;
  section: { slug: string };
  technicalSheet: {
    serie: string | null;
    numeroPemex: string | null;
    capacidadTanque: string | null;
    numeroUltimoUltrasonido: string | null;
    fechaProximoUltrasonido: Date | null;
  } | null;
};

function aUnidad(r: Fila): UnidadConjunto {
  return {
    id: r.id,
    numeroEconomico: r.numeroEconomico,
    marca: r.sucursal,
    anio: r.anio,
    placas: r.placas,
    activo: r.activo,
    esTractocamion: r.section.slug === TRACTOCAMIONES_SLUG,
    serie: r.technicalSheet?.serie ?? null,
    numeroPemex: r.technicalSheet?.numeroPemex ?? null,
    capacidad: r.technicalSheet?.capacidadTanque ?? null,
    numeroUltrasonido: r.technicalSheet?.numeroUltimoUltrasonido ?? null,
    proximoUltrasonido: r.technicalSheet?.fechaProximoUltrasonido ?? null,
  };
}

// "Dictamen 2" antes que "Dictamen 10".
function porNombre(a: { nombre: string }, b: { nombre: string }) {
  return a.nombre.localeCompare(b.nombre, "es", { numeric: true });
}

export async function getConjuntosDeCiudad(cityId: string): Promise<{
  conjuntos: ConjuntoVista[];
  tractocamiones: UnidadConjunto[];
  semirremolques: UnidadConjunto[];
  tractocamionesSinConjunto: UnidadConjunto[];
  semirremolquesSinConjunto: UnidadConjunto[];
  conjuntoDeSemirremolque: Record<string, string>;
}> {
  const [conjuntos, unidades] = await Promise.all([
    prisma.conjuntoTransporte.findMany({
      where: { cityId },
      include: {
        tractocamion: { select: unidadSelect },
        semirremolques: { orderBy: { orden: "asc" }, include: { vehicleRecord: { select: unidadSelect } } },
      },
    }),
    prisma.vehicleRecord.findMany({
      where: { section: { cityId, slug: { in: [TRACTOCAMIONES_SLUG, SEMIRREMOLQUES_SLUG] } } },
      select: unidadSelect,
      orderBy: { numeroEconomico: "asc" },
    }),
  ]);

  const vista: ConjuntoVista[] = conjuntos
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      observaciones: c.observaciones,
      tractocamion: c.tractocamion ? aUnidad(c.tractocamion) : null,
      semirremolques: c.semirremolques.map((s) => aUnidad(s.vehicleRecord)),
    }))
    .sort(porNombre);

  const todas = unidades.map(aUnidad).sort((a, b) => a.numeroEconomico.localeCompare(b.numeroEconomico, "es", { numeric: true }));
  const tractosEnConjunto = new Set(vista.map((c) => c.tractocamion?.id).filter(Boolean));
  const conjuntoDeSemirremolque: Record<string, string> = {};
  for (const c of vista) for (const s of c.semirremolques) conjuntoDeSemirremolque[s.id] = c.nombre;

  return {
    conjuntos: vista,
    tractocamiones: todas.filter((u) => u.esTractocamion),
    semirremolques: todas.filter((u) => !u.esTractocamion),
    tractocamionesSinConjunto: todas.filter((u) => u.esTractocamion && !tractosEnConjunto.has(u.id)),
    semirremolquesSinConjunto: todas.filter((u) => !u.esTractocamion && !conjuntoDeSemirremolque[u.id]),
    conjuntoDeSemirremolque,
  };
}

// Para la página de una unidad: en qué conjunto(s) está y con quién.
export async function getConjuntosDeUnidad(vehicleRecordId: string): Promise<ConjuntoVista[]> {
  const conjuntos = await prisma.conjuntoTransporte.findMany({
    where: {
      OR: [{ tractocamionId: vehicleRecordId }, { semirremolques: { some: { vehicleRecordId } } }],
    },
    include: {
      tractocamion: { select: unidadSelect },
      semirremolques: { orderBy: { orden: "asc" }, include: { vehicleRecord: { select: unidadSelect } } },
    },
  });
  return conjuntos
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      observaciones: c.observaciones,
      tractocamion: c.tractocamion ? aUnidad(c.tractocamion) : null,
      semirremolques: c.semirremolques.map((s) => aUnidad(s.vehicleRecord)),
    }))
    .sort(porNombre);
}
