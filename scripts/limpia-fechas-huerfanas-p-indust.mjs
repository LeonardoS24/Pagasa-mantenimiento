// "P. Indust" (Hermosillo) tiene 2 tanques (ver StationTankTechnicalSheet):
// desde que las 5 pruebas periódicas de un registro multi-tanque viven por
// tanque y no en la ficha compartida del vehículo (ver isMultiTanque en la
// página de detalle), 3 fechas que quedaron en esa ficha compartida desde
// antes del cambio (ultrasonido, visual interna e hidrostática, las 3
// vencidas desde el 2006-10-01) dejaron de mostrarse en cualquier alerta:
// ni el código viejo (que ya no las lee, por ser multi-tanque) ni el nuevo
// (que las busca en cada tanque, donde nunca se capturaron) las toma en
// cuenta.
//
// No hay forma de saber a cuál de los dos tanques correspondía cada fecha
// originalmente, así que por indicación explícita del usuario se omiten en
// vez de asignarlas a un tanque al azar: se capturarán de nuevo por tanque
// cuando se tenga la fecha real de cada uno.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const record = await prisma.vehicleRecord.findFirstOrThrow({
  where: { numeroEconomico: "P. Indust", section: { slug: "estaciones-de-carburacion" } },
});

await prisma.vehicleTechnicalSheet.update({
  where: { vehicleRecordId: record.id },
  data: {
    fechaProximoUltrasonido: null,
    fechaProximaInspeccionVisualInterna: null,
    fechaProximaPruebaHidrostatica: null,
  },
});

console.log("Fechas huérfanas de P. Indust limpiadas.");
await prisma.$disconnect();
