import { prisma } from "./prisma";
import { ESTACION_LIKE_SECTION_SLUGS } from "./estacion-sections";
import { isAggregateCitySlug } from "./aggregate-city";
import { SEMIRREMOLQUES_SLUG, TRACTOCAMIONES_SLUG } from "./kino-sections";

// Cambiar una unidad de distribución de ciudad. Una unidad pertenece a un
// apartado y el apartado a una ciudad (VehicleRecord.sectionId), así que
// "moverla" es ponerla en el apartado del mismo tipo de la ciudad destino. Su
// id no cambia: la ficha, las bitácoras, los documentos (en disco van por id de
// unidad/bitácora) y el historial se van con ella. Las alertas, el calendario y
// el tablero cambian de ciudad solos porque salen del apartado.
//
// Aquí vive la lógica (sin Next) para poder probarla contra una copia de la
// base; la acción del servidor (actions/traspaso-actions.ts) solo pide rol,
// acceso, contraseña y llama a estas funciones.

const APARTADO_PADRE_SLUG = "unidad-de-distribucion";

// Solo unidades de distribución. Quedan fuera estaciones y planta (aunque
// cuelguen del mismo apartado padre) y todo lo que no sea una unidad.
export const SLUGS_TRASPASABLES = [
  "auto-tanques",
  "vehiculo-de-reparto",
  "vehiculo-con-tanque-de-carburacion",
  "unidades-utilitarias",
  TRACTOCAMIONES_SLUG,
  SEMIRREMOLQUES_SLUG,
];

// Auto-Tanques y Vehículo con tanque de carburación pueden ser el mismo camión
// físico, con el mismo número económico en los dos apartados (ver
// PAIRED_VEHICLE_SECTION_SLUGS en actions/vehicle-actions.ts): se mueven juntos.
const PAR_DE_APARTADO: Record<string, string> = {
  "auto-tanques": "vehiculo-con-tanque-de-carburacion",
  "vehiculo-con-tanque-de-carburacion": "auto-tanques",
};

export function esApartadoTraspasable(slug: string): boolean {
  return SLUGS_TRASPASABLES.includes(slug) && !ESTACION_LIKE_SECTION_SLUGS.includes(slug);
}

// Para comparar números económicos sin que importen mayúsculas, espacios ni
// guiones ("KG 133" = "kg-133" = "KG133").
function claveDeNumero(numero: string): string {
  return numero.toLowerCase().replace(/[\s\-_.]+/g, "");
}

const incluirApartado = {
  section: { include: { city: true, parent: { select: { slug: true } } } },
} as const;

type UnidadConApartado = NonNullable<Awaited<ReturnType<typeof cargarUnidad>>>;

async function cargarUnidad(vehicleId: string) {
  return prisma.vehicleRecord.findUnique({ where: { id: vehicleId }, include: incluirApartado });
}

async function cargarPar(unidad: UnidadConApartado) {
  const slugPar = PAR_DE_APARTADO[unidad.section.slug];
  if (!slugPar) return null;
  return prisma.vehicleRecord.findFirst({
    where: {
      id: { not: unidad.id },
      numeroEconomico: unidad.numeroEconomico,
      section: { cityId: unidad.section.cityId, slug: slugPar, parent: { slug: APARTADO_PADRE_SLUG } },
    },
    include: incluirApartado,
  });
}

// Un tractocamión o semirremolque que va en un conjunto de Kino no se mueve:
// el conjunto (ConjuntoTransporte) es de la ciudad y se rompería. Hay que
// sacarlo del conjunto primero.
async function motivoDeBloqueo(unidad: UnidadConApartado): Promise<string | null> {
  const slug = unidad.section.slug;
  if (!esApartadoTraspasable(slug) || unidad.section.parent?.slug !== APARTADO_PADRE_SLUG) {
    return "Solo se pueden cambiar de ciudad las unidades de distribución (no estaciones ni planta).";
  }
  if (slug === TRACTOCAMIONES_SLUG) {
    const enConjuntos = await prisma.conjuntoTransporte.count({ where: { tractocamionId: unidad.id } });
    if (enConjuntos > 0) {
      return `Este tractocamión está en ${enConjuntos} conjunto(s). Sácalo de los conjuntos antes de cambiarlo de ciudad.`;
    }
  }
  if (slug === SEMIRREMOLQUES_SLUG) {
    const enConjunto = await prisma.conjuntoSemirremolque.count({ where: { vehicleRecordId: unidad.id } });
    if (enConjunto > 0) {
      return "Este semirremolque está en un conjunto. Sácalo del conjunto antes de cambiarlo de ciudad.";
    }
  }
  return null;
}

// El apartado del mismo tipo (mismo slug, dentro de Unidad de distribución) en
// otra ciudad, o null si esa ciudad no lo tiene.
async function apartadoDestino(cityId: string, slug: string) {
  return prisma.section.findFirst({
    where: { cityId, slug, parent: { slug: APARTADO_PADRE_SLUG } },
    select: { id: true, name: true },
  });
}

export type OpcionesDeTraspaso = {
  // null si se puede; si no, el motivo (se muestra en lugar del formulario).
  bloqueo: string | null;
  // Ciudades a las que sí se puede ir (tienen el apartado, y el de la pareja).
  ciudades: { id: string; name: string }[];
  // La otra mitad de la pareja Auto-Tanque / carburación, si existe: se va junto.
  par: { numeroEconomico: string; apartado: string } | null;
};

export async function getOpcionesDeTraspaso(vehicleId: string): Promise<OpcionesDeTraspaso> {
  const unidad = await cargarUnidad(vehicleId);
  if (!unidad) return { bloqueo: "La unidad ya no existe.", ciudades: [], par: null };

  const bloqueo = await motivoDeBloqueo(unidad);
  if (bloqueo) return { bloqueo, ciudades: [], par: null };

  const par = await cargarPar(unidad);
  const otras = await prisma.city.findMany({
    where: { id: { not: unidad.section.cityId } },
    orderBy: [{ order: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });

  const ciudades: { id: string; name: string }[] = [];
  for (const ciudad of otras) {
    if (isAggregateCitySlug(ciudad.slug)) continue;
    if (!(await apartadoDestino(ciudad.id, unidad.section.slug))) continue;
    if (par && !(await apartadoDestino(ciudad.id, par.section.slug))) continue;
    ciudades.push({ id: ciudad.id, name: ciudad.name });
  }

  return {
    bloqueo: ciudades.length === 0 ? "Ninguna otra ciudad tiene el apartado de este tipo de unidad." : null,
    ciudades,
    par: par ? { numeroEconomico: par.numeroEconomico, apartado: par.section.name } : null,
  };
}

export type ResultadoTraspaso =
  | { error: string }
  | {
      ok: true;
      origen: { nombre: string; slug: string };
      destino: { nombre: string; slug: string };
      // Las unidades que cambiaron (la pareja va con la principal).
      movidas: { id: string; numeroEconomico: string; apartadoSlug: string; apartadoAnteriorId: string }[];
      // Slugs de ciudad y rutas de apartado a revalidar.
      sectionIds: string[];
    };

export async function trasladarUnidad(params: {
  vehicleId: string;
  destinoCityId: string;
  motivo: string | null;
  userId: string;
  username: string;
}): Promise<ResultadoTraspaso> {
  const unidad = await cargarUnidad(params.vehicleId);
  if (!unidad) return { error: "La unidad ya no existe." };

  const bloqueo = await motivoDeBloqueo(unidad);
  if (bloqueo) return { error: bloqueo };

  if (unidad.section.cityId === params.destinoCityId) {
    return { error: "La unidad ya está en esa ciudad." };
  }
  const destino = await prisma.city.findUnique({ where: { id: params.destinoCityId } });
  if (!destino) return { error: "La ciudad destino no existe." };
  if (isAggregateCitySlug(destino.slug)) {
    return { error: "Administración no tiene flota propia: elige una ciudad real." };
  }

  const par = await cargarPar(unidad);
  const aMover = [unidad, ...(par ? [par] : [])];

  // Cada una va al apartado de su mismo tipo; si falta alguno, no se mueve nada.
  const plan: { unidad: UnidadConApartado; destinoSectionId: string }[] = [];
  for (const u of aMover) {
    const apartado = await apartadoDestino(destino.id, u.section.slug);
    if (!apartado) {
      return { error: `${destino.name} no tiene el apartado "${u.section.name}". Créalo antes en Ciudades y apartados.` };
    }
    const existentes = await prisma.vehicleRecord.findMany({
      where: { sectionId: apartado.id },
      select: { numeroEconomico: true },
    });
    const clave = claveDeNumero(u.numeroEconomico);
    if (existentes.some((e) => claveDeNumero(e.numeroEconomico) === clave)) {
      return {
        error: `${destino.name} ya tiene "${u.numeroEconomico}" en ${apartado.name}. Revisa que no sea la misma unidad o cámbiale el número antes de moverla.`,
      };
    }
    plan.push({ unidad: u, destinoSectionId: apartado.id });
  }

  const origen = { nombre: unidad.section.city.name, slug: unidad.section.city.slug };

  await prisma.$transaction(async (tx) => {
    for (const { unidad: u, destinoSectionId } of plan) {
      const ultimo = await tx.vehicleRecord.aggregate({
        where: { sectionId: destinoSectionId },
        _max: { order: true },
      });

      await tx.vehicleRecord.update({
        where: { id: u.id },
        data: { sectionId: destinoSectionId, order: (ultimo._max.order ?? 0) + 1 },
      });

      // El documento guarda el apartado donde se subió y "Documentos de
      // pruebas" filtra por la ciudad de ese apartado: los de la unidad y los de
      // sus bitácoras pasan al apartado nuevo. Los archivos en disco no se
      // tocan (su carpeta es por id de unidad / bitácora, no de apartado).
      const deLaUnidad = { vehicleRecordId: u.id };
      await tx.document.updateMany({
        where: {
          OR: [
            deLaUnidad,
            { maintenanceLog: deLaUnidad },
            { ultrasoundLog: deLaUnidad },
            { visualInspectionLog: deLaUnidad },
            { tightnessTestLog: deLaUnidad },
            { internalVisualInspectionLog: deLaUnidad },
            { hydrostaticTestLog: deLaUnidad },
            { extinguisherChangeLog: deLaUnidad },
            { insurancePolicyLog: deLaUnidad },
            { valveChangeLog: deLaUnidad },
            { valveCorrectiveMaintenanceLog: deLaUnidad },
            { hoseChangeLog: deLaUnidad },
          ],
        },
        data: { sectionId: destinoSectionId },
      });

      await tx.traspasoUnidad.create({
        data: {
          vehicleRecordId: u.id,
          numeroEconomico: u.numeroEconomico,
          apartadoSlug: u.section.slug,
          origenCiudadNombre: origen.nombre,
          origenCiudadSlug: origen.slug,
          destinoCiudadNombre: destino.name,
          destinoCiudadSlug: destino.slug,
          motivo: params.motivo,
          userId: params.userId,
          username: params.username,
        },
      });
    }
  });

  return {
    ok: true,
    origen,
    destino: { nombre: destino.name, slug: destino.slug },
    movidas: plan.map(({ unidad: u }) => ({
      id: u.id,
      numeroEconomico: u.numeroEconomico,
      apartadoSlug: u.section.slug,
      apartadoAnteriorId: u.sectionId,
    })),
    sectionIds: plan.flatMap(({ unidad: u, destinoSectionId }) => [u.sectionId, destinoSectionId]),
  };
}
