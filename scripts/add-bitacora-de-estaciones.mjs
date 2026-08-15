// Agrega el apartado "Bitácora de estaciones" a todas las ciudades ya
// existentes (nuevas ciudades ya lo reciben solo con crearApartadosEstandar,
// ver lib/city-template.ts). Se coloca justo después de "Bitácoras de
// unidades", recorriendo el order del resto de apartados hacia abajo para no
// dejar huecos ni empatar order con otro apartado.
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const cities = await prisma.city.findMany({ select: { id: true, name: true } });

for (const city of cities) {
  const existing = await prisma.section.findFirst({
    where: { cityId: city.id, parentId: null, slug: "bitacora-de-estaciones" },
  });
  if (existing) {
    console.log(`SKIP (${city.name}): ya existe`);
    continue;
  }

  const bitacoraUnidades = await prisma.section.findFirst({
    where: { cityId: city.id, parentId: null, slug: "bitacoras-de-unidades" },
  });
  const order = bitacoraUnidades ? bitacoraUnidades.order + 1 : 4;

  // Recorre hacia abajo el order de todo lo que ya estaba en o después de
  // ese lugar, para insertar sin pisar a nadie.
  await prisma.section.updateMany({
    where: { cityId: city.id, parentId: null, order: { gte: order } },
    data: { order: { increment: 1 } },
  });

  await prisma.section.create({
    data: { cityId: city.id, parentId: null, slug: "bitacora-de-estaciones", name: "Bitácora de estaciones", order },
  });
  console.log(`CREATE (${city.name}): Bitácora de estaciones en order ${order}`);
}

await prisma.$disconnect();
