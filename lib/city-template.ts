import { prisma } from "./prisma";
import { slugify } from "./slugify";
import { TRACTOCAMIONES_SLUG, SEMIRREMOLQUES_SLUG } from "./kino-sections";

// Estructura estándar con la que nace toda ciudad. Antes una ciudad nueva
// quedaba vacía y había que crear a mano los 10 apartados y los 4
// sub-apartados de Unidad de distribución; si alguien escribía el nombre
// distinto, el slug no coincidía y el apartado no activaba sus funciones
// (válvulas, mangueras, pruebas del tanque). Aquí el slug va explícito
// justamente para no depender de cómo se escriba el nombre.
export type PlantillaApartado = {
  name: string;
  slug: string;
  children?: PlantillaApartado[];
};

export const PLANTILLA_APARTADOS: PlantillaApartado[] = [
  {
    name: "Unidad de distribución",
    slug: "unidad-de-distribucion",
    children: [
      { name: "Auto-Tanques", slug: "auto-tanques" },
      { name: "Vehículo de reparto", slug: "vehiculo-de-reparto" },
      { name: "Vehículo con tanque de carburación", slug: "vehiculo-con-tanque-de-carburacion" },
      { name: "Unidades utilitarias", slug: "unidades-utilitarias" },
    ],
  },
  { name: "Manuales", slug: "manuales" },
  { name: "Programa de mantenimiento", slug: "programa-de-mantenimiento" },
  // Antes eran dos apartados separados (Equipos Mecánicos / Equipos
  // electrónicos); el usuario pidió fusionarlos en uno solo donde el tipo de
  // equipo se elige al dar de alta (ver Equipo.tipoEquipo en el schema).
  { name: "Equipos", slug: "equipos" },
  { name: "Bitácoras de unidades", slug: "bitacoras-de-unidades" },
  // Igual que Bitácoras de unidades, pero acotado a Estaciones de
  // carburación y Planta (ver ESTACION_LIKE_SECTION_SLUGS en
  // lib/estacion-sections.ts): todos los mantenimientos de estaciones en
  // un solo feed, sin mezclarse con los de las unidades normales.
  { name: "Bitácora de estaciones", slug: "bitacora-de-estaciones" },
  // Misma fusión que arriba, para la bitácora.
  { name: "Bitácora de equipos", slug: "bitacora-de-equipos" },
  // El nombre es "Orden" pero el slug histórico es "orden-de-pieza": por eso
  // la plantilla lleva ambos y no deriva uno del otro.
  { name: "Orden", slug: "orden-de-pieza" },
  { name: "Inventarios", slug: "inventarios" },
];

// Transportadora Kino no lleva la plantilla de arriba: solo sus unidades
// (tractocamiones y semirremolques) y la bitácora de esas unidades. Nada de
// planta, estaciones, equipos, inventarios, órdenes ni manuales.
export const KINO_CITY_SLUG = "transportadora-kino";

export const PLANTILLA_KINO: PlantillaApartado[] = [
  {
    name: "Unidad de distribución",
    slug: "unidad-de-distribucion",
    children: [
      { name: "Tractocamiones", slug: TRACTOCAMIONES_SLUG },
      { name: "Semirremolques", slug: SEMIRREMOLQUES_SLUG },
    ],
  },
  { name: "Bitácoras de unidades", slug: "bitacoras-de-unidades" },
];

export function plantillaDeCiudad(citySlug: string): PlantillaApartado[] {
  return citySlug === KINO_CITY_SLUG ? PLANTILLA_KINO : PLANTILLA_APARTADOS;
}

// Crea los apartados que falten, respetando los que ya existan (por slug).
// Es idempotente, así que sirve tanto al crear una ciudad como para
// completar una que quedó a medias.
export async function crearApartadosEstandar(cityId: string): Promise<number> {
  let creados = 0;

  async function crearNivel(apartados: PlantillaApartado[], parentId: string | null) {
    for (const [indice, apartado] of apartados.entries()) {
      let seccion = await prisma.section.findFirst({
        where: { cityId, parentId, slug: apartado.slug },
      });

      if (!seccion) {
        seccion = await prisma.section.create({
          data: { cityId, parentId, name: apartado.name, slug: apartado.slug, order: indice },
        });
        creados++;
      }

      if (apartado.children?.length) {
        await crearNivel(apartado.children, seccion.id);
      }
    }
  }

  const ciudad = await prisma.city.findUnique({ where: { id: cityId }, select: { slug: true } });
  await crearNivel(plantillaDeCiudad(ciudad?.slug ?? ""), null);
  return creados;
}

// Los slugs de los que sí generamos con slugify siguen coincidiendo con su
// nombre; si algún día se renombra un apartado de la plantilla, esto avisa.
export function plantillaEsConsistente(): boolean {
  return PLANTILLA_APARTADOS.filter((a) => a.slug !== "orden-de-pieza").every(
    (a) => slugify(a.name) === a.slug
  );
}
