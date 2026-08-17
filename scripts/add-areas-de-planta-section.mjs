// Agrega el tercer hijo "Áreas de planta" (slug "areas-de-planta") a cada
// "Planta" existente (ver scripts/restructure-planta-section.mjs), junto a
// "planta-ficha-tecnica" y "equipos". Las 15 áreas en sí no son filas de
// Section: viven como lista fija en lib/plant-areas.ts.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const plantaSections = await prisma.section.findMany({
  where: { slug: "planta", parentId: null },
  include: { city: true, children: true },
});

for (const planta of plantaSections) {
  const existing = planta.children.find((c) => c.slug === "areas-de-planta");
  if (existing) {
    console.log(`SKIP ${planta.city.name}: ya existe "areas-de-planta"`);
    continue;
  }

  const maxOrder = Math.max(...planta.children.map((c) => c.order), -1);
  await prisma.section.create({
    data: {
      cityId: planta.cityId,
      parentId: planta.id,
      slug: "areas-de-planta",
      name: "Áreas de planta",
      order: maxOrder + 1,
    },
  });
  console.log(`CREATE ${planta.city.name}: Áreas de planta`);
}

await prisma.$disconnect();
