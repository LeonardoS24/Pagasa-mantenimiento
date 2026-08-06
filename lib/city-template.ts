import { prisma } from "./prisma";
import { slugify } from "./slugify";

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
  // Misma fusión que arriba, para la bitácora.
  { name: "Bitácora de equipos", slug: "bitacora-de-equipos" },
  // El nombre es "Orden" pero el slug histórico es "orden-de-pieza": por eso
  // la plantilla lleva ambos y no deriva uno del otro.
  { name: "Orden", slug: "orden-de-pieza" },
  { name: "Inventarios", slug: "inventarios" },
];

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

  await crearNivel(PLANTILLA_APARTADOS, null);
  return creados;
}

// Los slugs de los que sí generamos con slugify siguen coincidiendo con su
// nombre; si algún día se renombra un apartado de la plantilla, esto avisa.
export function plantillaEsConsistente(): boolean {
  return PLANTILLA_APARTADOS.filter((a) => a.slug !== "orden-de-pieza").every(
    (a) => slugify(a.name) === a.slug
  );
}
