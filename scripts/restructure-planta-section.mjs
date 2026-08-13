// Convierte el apartado top-level "Equipos" (ya renombrado a "Equipos de
// planta", ver scripts/rename-equipos-de-planta.mjs) en un hijo de un nuevo
// apartado padre "Planta", junto con un segundo hijo nuevo
// "planta-ficha-tecnica" (nombre visible "Planta") que se comporta como una
// Estación de carburación (ficha técnica de tanque + 5 registros de
// inspección + permisos), pero sin su propio sub-listado de equipos — esos
// viven en el hijo "Equipos de planta".
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const equiposSections = await prisma.section.findMany({
  where: { slug: "equipos", parentId: null },
  include: { city: { select: { name: true } } },
});

for (const equipos of equiposSections) {
  const existingPlanta = await prisma.section.findFirst({
    where: { cityId: equipos.cityId, parentId: null, slug: "planta" },
  });
  if (existingPlanta) {
    console.log(`SKIP ${equipos.city.name}: ya existe "planta"`);
    continue;
  }

  const planta = await prisma.section.create({
    data: { cityId: equipos.cityId, parentId: null, slug: "planta", name: "Planta", order: equipos.order },
  });

  await prisma.section.update({
    where: { id: equipos.id },
    data: { parentId: planta.id, order: 1 },
  });

  await prisma.section.create({
    data: {
      cityId: equipos.cityId,
      parentId: planta.id,
      slug: "planta-ficha-tecnica",
      name: "Planta",
      order: 0,
    },
  });

  console.log(`CREATE ${equipos.city.name}: Planta (con Planta + Equipos de planta adentro)`);
}

await prisma.$disconnect();
