// Agrega el apartado "Resumen" (order 9) solo a la ciudad "Administración":
// antes vivía en /admin/resumen, ahora es un apartado más de esa ciudad
// especial (ver lib/aggregate-city.ts).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const city = await prisma.city.findUnique({ where: { slug: "administracion" } });
if (!city) {
  throw new Error("No existe la ciudad Administración");
}

const existing = await prisma.section.findFirst({
  where: { cityId: city.id, parentId: null, slug: "resumen" },
});
if (existing) {
  console.log("SKIP: ya existe");
} else {
  await prisma.section.create({
    data: { cityId: city.id, parentId: null, slug: "resumen", name: "Resumen", order: 9 },
  });
  console.log("CREATE: Resumen en Administración");
}

await prisma.$disconnect();
