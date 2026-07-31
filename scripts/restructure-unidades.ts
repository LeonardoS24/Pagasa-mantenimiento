import { prisma } from "../lib/prisma";
import { slugify } from "../lib/slugify";

const TARGET_ORDER = [
  "Auto-Tanques",
  "Vehículo de reparto",
  "Vehículo con tanque de carburación",
  "Unidades utilitarias",
  "Parque Vehicular",
];

// Mapea los sub-apartados que ya existían en Hermosillo (por su slug actual)
// al nuevo nombre correspondiente, para renombrarlos sin perder sus
// VehicleRecord/Document asociados (referencian sectionId, no el slug).
const HERMOSILLO_RENAMES: Record<string, string> = {
  autotanques: "Auto-Tanques",
  "automovil-con-tanque-de-carburacion": "Vehículo con tanque de carburación",
  "parque-vehicular": "Parque Vehicular",
};

async function main() {
  const cities = await prisma.city.findMany();

  for (const city of cities) {
    const root = await prisma.section.findFirst({
      where: { cityId: city.id, parentId: null, slug: "unidad-de-distribucion" },
    });
    if (!root) {
      console.warn(`[SKIP] ${city.name}: no tiene apartado "Unidad de distribución".`);
      continue;
    }

    const existing = await prisma.section.findMany({
      where: { cityId: city.id, parentId: root.id },
    });
    const existingBySlug = new Map(existing.map((section) => [section.slug, section]));

    // Renombrar los que ya existían (solo aplica hoy a Hermosillo).
    for (const [oldSlug, newName] of Object.entries(HERMOSILLO_RENAMES)) {
      const match = existingBySlug.get(oldSlug);
      if (match) {
        const newSlug = slugify(newName);
        await prisma.section.update({
          where: { id: match.id },
          data: { name: newName, slug: newSlug },
        });
        existingBySlug.delete(oldSlug);
        existingBySlug.set(newSlug, { ...match, name: newName, slug: newSlug });
      }
    }

    // Crear los que falten y fijar el order final según TARGET_ORDER.
    for (const [index, name] of TARGET_ORDER.entries()) {
      const slug = slugify(name);
      const current = await prisma.section.findFirst({
        where: { cityId: city.id, parentId: root.id, slug },
      });

      if (current) {
        await prisma.section.update({ where: { id: current.id }, data: { order: index } });
      } else {
        await prisma.section.create({
          data: { cityId: city.id, parentId: root.id, name, slug, order: index },
        });
      }
    }

    console.warn(`[OK] ${city.name}: sub-apartados de unidades listos.`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
