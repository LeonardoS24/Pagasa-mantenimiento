// Corrige lo que quedó del import de "Equipos principales Estaciones.xlsx"
// (ver scripts/import-equipos-estaciones.mjs): cuando la columna CANTIDAD
// era mayor a 1, se había creado un solo Equipo con una nota "Cantidad: N"
// en observaciones. El usuario pidió que en vez de eso sean N equipos
// independientes (así cada uno se puede dar de baja, o traer su propia
// bitácora, por separado). Cuando el número de serie venía compuesto (dos
// series separadas por coma, para 2 unidades), se reparte una por equipo en
// vez de repetir el mismo texto en los dos.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const equipos = await prisma.equipo.findMany({
  where: { observaciones: { contains: "Cantidad:" } },
  select: {
    id: true,
    sectionId: true,
    vehicleRecordId: true,
    tipoEquipo: true,
    nombre: true,
    capacidad: true,
    anioFabricacion: true,
    numeroSerie: true,
    marca: true,
    modelo: true,
    observaciones: true,
    order: true,
    vehicleRecord: { select: { numeroEconomico: true } },
  },
});

let creados = 0;
let eliminados = 0;

for (const e of equipos) {
  const m = e.observaciones.match(/Cantidad:\s*(\d+)/);
  const cantidad = m ? Number(m[1]) : 1;
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    console.log(`OMITIDO ${e.vehicleRecord?.numeroEconomico} / ${e.nombre}: cantidad inválida en "${e.observaciones}"`);
    continue;
  }

  // El resto de la nota, sin la parte de "Cantidad: N" (ej. "Instalado ·
  // Cantidad: 2" -> "Instalado"), se conserva en cada equipo nuevo.
  const notaRestante =
    e.observaciones
      .replace(/Cantidad:\s*\d+/, "")
      .replace(/\s*·\s*$/, "")
      .replace(/^\s*·\s*/, "")
      .trim() || null;

  // Serie compuesta ("66AXJ, 28AWK") -> una por equipo, en el mismo orden.
  const series = e.numeroSerie ? e.numeroSerie.split(",").map((s) => s.trim()) : [];
  const serieCompuesta = series.length === cantidad;

  console.log(
    `${e.vehicleRecord?.numeroEconomico} / ${e.nombre}: 1 registro -> ${cantidad} equipos` +
      (serieCompuesta ? ` (series: ${series.join(" | ")})` : "")
  );

  if (DRY_RUN) continue;

  const maxOrder = await prisma.equipo.aggregate({
    where: { sectionId: e.sectionId, vehicleRecordId: e.vehicleRecordId },
    _max: { order: true },
  });
  let siguienteOrder = maxOrder._max.order ?? -1;

  await prisma.equipo.delete({ where: { id: e.id } });
  eliminados++;

  for (let i = 0; i < cantidad; i++) {
    siguienteOrder++;
    await prisma.equipo.create({
      data: {
        sectionId: e.sectionId,
        vehicleRecordId: e.vehicleRecordId,
        tipoEquipo: e.tipoEquipo,
        nombre: e.nombre,
        capacidad: e.capacidad,
        anioFabricacion: e.anioFabricacion,
        numeroSerie: serieCompuesta ? series[i] : e.numeroSerie,
        marca: e.marca,
        modelo: e.modelo,
        observaciones: notaRestante,
        order: siguienteOrder,
      },
    });
    creados++;
  }
}

console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Registros combinados eliminados: ${eliminados}`);
console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Equipos individuales creados: ${creados}`);

await prisma.$disconnect();
