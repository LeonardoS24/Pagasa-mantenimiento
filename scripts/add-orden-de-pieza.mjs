// Agrega el apartado fijo "Orden de Pieza" (order 8, justo antes de
// Inventarios) a todas las ciudades existentes.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const cities = await prisma.city.findMany();
for (const city of cities) {
  const existing = await prisma.section.findFirst({
    where: { cityId: city.id, parentId: null, slug: "orden-de-pieza" },
  });
  if (existing) {
    console.log(`SKIP ${city.name}: ya existe`);
    continue;
  }

  const inventarios = await prisma.section.findFirst({
    where: { cityId: city.id, parentId: null, slug: "inventarios" },
  });
  if (!inventarios) {
    console.log(`SKIP ${city.name}: no tiene apartado Inventarios`);
    continue;
  }

  await prisma.section.update({ where: { id: inventarios.id }, data: { order: 9 } });
  await prisma.section.create({
    data: {
      cityId: city.id,
      parentId: null,
      slug: "orden-de-pieza",
      name: "Orden de Pieza",
      order: 8,
    },
  });
  console.log(`CREATE ${city.name}: Orden de Pieza`);
}

await prisma.$disconnect();
