import { prisma } from "../lib/prisma";
const accion = process.argv[2];
const city = await prisma.city.findUniqueOrThrow({ where: { slug: "hermosillo" } });
const root = await prisma.section.findFirstOrThrow({ where: { cityId: city.id, parentId: null, slug: "unidad-de-distribucion" } });
if (accion === "crear") {
  let sec = await prisma.section.findFirst({ where: { cityId: city.id, parentId: root.id, slug: "auto-tanques" } });
  if (!sec) sec = await prisma.section.create({ data: { cityId: city.id, parentId: root.id, slug: "auto-tanques", name: "Auto-Tanques", order: 0 } });
  const d = (y: number, m: number, dd: number) => new Date(Date.UTC(y, m - 1, dd));
  const v = await prisma.vehicleRecord.create({ data: { sectionId: sec.id, numeroEconomico: "_MOVIL-1", sucursal: "International", anio: "2018", placas: "VW-123-X",
    technicalSheet: { create: { fechaProximoUltrasonido: d(2026, 10, 30), fechaFabricacionValvulaLlenado: d(2017, 3, 1), fechaFabricacionMangueraSurtir: d(2022, 5, 5), fechaProximaPruebaHermeticidad: d(2027, 1, 10) } } } });
  console.log(`/ciudades/hermosillo/vehiculo/${v.id}`, sec.id);
} else {
  const r = await prisma.vehicleRecord.deleteMany({ where: { numeroEconomico: "_MOVIL-1" } });
  const s = await prisma.section.deleteMany({ where: { cityId: city.id, slug: "auto-tanques", vehicleRecords: { none: {} } } });
  console.log("borrados", r.count, s.count, "quedan", await prisma.vehicleRecord.count({ where: { numeroEconomico: "_MOVIL-1" } }));
}
process.exit(0);
