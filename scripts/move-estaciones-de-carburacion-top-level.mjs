import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// El usuario pidió que "Estaciones de carburación" no viva dentro de
// "Unidad de distribución" (donde la había puesto una migración anterior,
// ver scripts/add-estaciones-de-carburacion.mjs) sino como su propio
// apartado de nivel superior, igual que Unidad de distribución. Mueve el
// Section existente de cada ciudad: parentId a null y un order libre entre
// los apartados de nivel superior (no hace falta recorrer los demás, ya
// había huecos sin usar en la numeración original).
const cities = await prisma.city.findMany();
let moved = 0;
for (const city of cities) {
  const section = await prisma.section.findFirst({
    where: { cityId: city.id, slug: "estaciones-de-carburacion" },
  });
  if (!section) {
    console.log(`${city.slug}: no tiene Estaciones de carburación, se omite`);
    continue;
  }
  if (section.parentId === null) {
    console.log(`${city.slug}: ya es de nivel superior, se omite`);
    continue;
  }
  const maxOrder = await prisma.section.aggregate({
    where: { cityId: city.id, parentId: null },
    _max: { order: true },
  });
  await prisma.section.update({
    where: { id: section.id },
    data: { parentId: null, order: (maxOrder._max.order ?? -1) + 1 },
  });
  console.log(`${city.slug}: movida a nivel superior (order ${(maxOrder._max.order ?? -1) + 1})`);
  moved++;
}
console.log(`\nTotal movidas: ${moved}`);
await prisma.$disconnect();
