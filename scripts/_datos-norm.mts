import { prisma } from "../lib/prisma";
import { hashPassword } from "../lib/password";
const accion = process.argv[2];
const city = await prisma.city.findUniqueOrThrow({ where: { slug: "hermosillo" } });
const root = await prisma.section.findFirstOrThrow({ where: { cityId: city.id, parentId: null, slug: "unidad-de-distribucion" } });
if (accion === "crear") {
  const sec = await prisma.section.create({ data: { cityId: city.id, parentId: root.id, slug: "auto-tanques", name: "Auto-Tanques" } });
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  const sup = await prisma.user.create({ data: { username: "_supervisor", passwordHash: await hashPassword("Supervisor clave 2026"), role: "USUARIO", puesto: "Supervisor", cityAccess: { create: { cityId: city.id } } } });
  const d = (a: number, m: number, dd: number) => new Date(Date.UTC(a, m - 1, dd));
  const v = await prisma.vehicleRecord.create({ data: { sectionId: sec.id, numeroEconomico: "_AT-EXP", sucursal: "International", anio: "2019", placas: "ABC-1",
    technicalSheet: { create: { fechaProximoUltrasonido: d(2026, 11, 20), fechaProximaInspeccionVisual: d(2027, 3, 5), fechaProximaPruebaHermeticidad: d(2026, 9, 1), fechaFabricacionValvulaLlenado: d(2017, 6, 1), fechaFabricacionMangueraSurtir: d(2023, 2, 1), fechaDictamenOperacion: d(2026, 4, 10) } } } });
  await prisma.maintenanceLog.create({ data: { vehicleRecordId: v.id, tipoMantenimiento: "PREVENTIVO", tipoServicio: "INTERNO", fecha: d(2026, 5, 15), descripcion: "Revisión de fugas", createdById: admin.id } as never });
  await prisma.ultrasoundLog.create({ data: { vehicleRecordId: v.id, fechaRealizacion: d(2026, 2, 3), fechaProximoUltrasonido: d(2026, 11, 20), createdById: sup.id } as never });
  console.log(v.id);
} else {
  const v = await prisma.vehicleRecord.findFirst({ where: { numeroEconomico: "_AT-EXP" } });
  if (v) {
    await prisma.vistoBueno.deleteMany({ where: { vehicleRecordId: v.id } });
    await prisma.maintenanceLog.deleteMany({ where: { vehicleRecordId: v.id } });
    await prisma.ultrasoundLog.deleteMany({ where: { vehicleRecordId: v.id } });
    await prisma.vehicleRecord.delete({ where: { id: v.id } });
  }
  await prisma.section.deleteMany({ where: { cityId: city.id, slug: "auto-tanques", vehicleRecords: { none: {} } } });
  await prisma.registroAcceso.deleteMany({});
  await prisma.sesionActiva.deleteMany({});
  await prisma.activityLog.deleteMany({ where: { entidad: "Visto bueno" } });
  await prisma.user.deleteMany({ where: { username: "_supervisor" } });
  console.log("quedan", await prisma.vehicleRecord.count({ where: { numeroEconomico: { startsWith: "_" } } }), await prisma.user.count({ where: { username: "_supervisor" } }), await prisma.vistoBueno.count());
}
process.exit(0);
