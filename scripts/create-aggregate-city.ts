// Crea la "ciudad" especial "Administración" (ver lib/aggregate-city.ts):
// una fila real en City, asignable a un usuario igual que cualquier otra
// (ver UserCityAccess / admin de usuarios), cuya Bitácora de unidades combina
// el feed y los gráficos de todas las ciudades reales. Idempotente: si ya
// existe, no hace nada.
import { prisma } from "../lib/prisma";
import { crearApartadosEstandar } from "../lib/city-template";
import { AGGREGATE_CITY_SLUG } from "../lib/aggregate-city";

async function main() {
  const existing = await prisma.city.findUnique({ where: { slug: AGGREGATE_CITY_SLUG } });
  if (existing) {
    console.log("Ya existe:", existing.id);
    return;
  }

  const maxOrder = await prisma.city.aggregate({ _max: { order: true } });

  const city = await prisma.city.create({
    data: {
      name: "Administración",
      slug: AGGREGATE_CITY_SLUG,
      order: (maxOrder._max.order ?? 0) + 1000,
    },
  });

  const creados = await crearApartadosEstandar(city.id);
  console.log("Ciudad creada:", city.id, "con", creados, "apartados.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
