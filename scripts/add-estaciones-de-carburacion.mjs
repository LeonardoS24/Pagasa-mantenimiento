import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Nueva categoría dentro de "Unidad de distribución", hermana de
// Auto-Tanques/Vehículo de reparto/Vehículo con tanque de
// carburación/Unidades utilitarias: mismo patrón (VehicleRecord +
// VehicleTechnicalSheet), solo que para estaciones de carburación en vez de
// vehículos. Se agrega a las 10 ciudades reales y a Administración (para que
// su vista combinada tenga dónde aparecer).
const cities = await prisma.city.findMany();
let created = 0;
for (const city of cities) {
  const unidadDist = await prisma.section.findFirst({
    where: { cityId: city.id, parentId: null, slug: "unidad-de-distribucion" },
  });
  if (!unidadDist) {
    console.log(`${city.slug}: sin Unidad de distribución, se omite`);
    continue;
  }
  const existing = await prisma.section.findFirst({
    where: { parentId: unidadDist.id, slug: "estaciones-de-carburacion" },
  });
  if (existing) {
    console.log(`${city.slug}: ya existe, se omite`);
    continue;
  }
  const maxOrder = await prisma.section.aggregate({
    where: { parentId: unidadDist.id },
    _max: { order: true },
  });
  await prisma.section.create({
    data: {
      cityId: city.id,
      parentId: unidadDist.id,
      name: "Estaciones de carburación",
      slug: "estaciones-de-carburacion",
      order: (maxOrder._max.order ?? -1) + 1,
    },
  });
  console.log(`${city.slug}: creado`);
  created++;
}
console.log(`\nTotal creado: ${created}`);
await prisma.$disconnect();
