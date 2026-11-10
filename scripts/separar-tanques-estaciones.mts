// Separa en dos fichas las estaciones a las que la importación del Excel
// "Fechas de valvulas.xls" les juntó dos tanques en uno solo (el renglón de
// TANQUES traía los dos: "1613 Y 1618", "CYTSA Y TATSA", "95 Y 00").
// Pedido del usuario el 9-nov-2026 (Pagasita, Huatabampo); al revisar las
// demás estaciones apareció también Bourlaug II (Cajeme).
//
// Igual que las estaciones de dos tanques que ya estaban bien (Pitic, Calle 12,
// Sufragio...), el juego de fechas de válvulas se queda en los dos tanques.
// Ninguna de las dos tenía pruebas ni registros ligados al tanque.
//
// Simula por defecto; con --apply guarda. Solo actúa si la ficha sigue
// exactamente como la dejó la importación: si alguien ya la corrigió a mano,
// no la toca y lo dice.
//
//   npx tsx scripts/separar-tanques-estaciones.mts
//   npx tsx scripts/separar-tanques-estaciones.mts --apply
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const aplicar = process.argv.includes("--apply");

type Datos = { numeroSerie: string; marca: string; anioFabricacion: string };

const CASOS: { ciudad: string; estacion: string; junto: Datos; tanque1: Datos; tanque2: Datos }[] = [
  {
    ciudad: "Huatabampo",
    estacion: "Pagasita",
    junto: { numeroSerie: "Serie A 118, V392", marca: "CYTSA Y TATSA", anioFabricacion: "95 Y 00" },
    tanque1: { numeroSerie: "A 118", marca: "CYTSA", anioFabricacion: "1995" },
    tanque2: { numeroSerie: "V392", marca: "TATSA", anioFabricacion: "2000" },
  },
  {
    ciudad: "Cajeme",
    estacion: "Bourlaug II",
    junto: { numeroSerie: "1613 Y 1618", marca: "TATSA", anioFabricacion: "Dec-99" },
    tanque1: { numeroSerie: "1613", marca: "TATSA", anioFabricacion: "1999" },
    tanque2: { numeroSerie: "1618", marca: "TATSA", anioFabricacion: "1999" },
  },
];

// Lo que se copia al segundo tanque: lo que es del juego (modelo, capacidad,
// tipo, válvulas, bitácora).
const COPIAR = [
  "modelo",
  "tipo",
  "capacidad",
  "fechaInstalacionValvulas",
  "tieneBitacoraMantenimientoValvulas",
  "fechaFabricacionValvulaExcesoFlujo",
  "fechaFabricacionValvulaNoRetroceso",
  "cantidadValvulasSeguridad",
  "fechaFabricacionValvulaSeguridad",
  "fechaFabricacionValvulaSeguridad2",
  "fechaFabricacionValvulaSeguridad3",
  "fechaFabricacionValvulaLlenado",
  "fechaFabricacionValvulaServicio",
  "fechaFabricacionValvulaCheckLock",
  "fechaFabricacionValvulaVapor",
] as const;

let cambios = 0;
for (const c of CASOS) {
  const estacion = await prisma.vehicleRecord.findFirst({
    where: {
      numeroEconomico: c.estacion,
      section: { slug: "estaciones-de-carburacion", city: { name: { startsWith: c.ciudad } } },
    },
    include: { stationTankTechnicalSheets: true, section: { include: { city: true } } },
  });
  if (!estacion) {
    console.log(`-- ${c.ciudad} / ${c.estacion}: no se encontró la estación.`);
    continue;
  }
  const tanques = estacion.stationTankTechnicalSheets;
  const t1 = tanques.find((t) => t.etiqueta === "Tanque 1");
  if (tanques.length !== 1 || !t1) {
    console.log(`-- ${estacion.section.city.name} / ${c.estacion}: ya tiene ${tanques.length} tanque(s); no se toca.`);
    continue;
  }
  const igual = (Object.keys(c.junto) as (keyof Datos)[]).every((k) => (t1[k] ?? "") === c.junto[k]);
  if (!igual) {
    console.log(`-- ${estacion.section.city.name} / ${c.estacion}: la ficha ya no es la de la importación; no se toca.`);
    continue;
  }
  const copia = Object.fromEntries(COPIAR.map((k) => [k, t1[k]]));
  console.log(`>> ${estacion.section.city.name} / ${c.estacion}`);
  console.log(`   Tanque 1: ${JSON.stringify(c.junto)} -> ${JSON.stringify(c.tanque1)}`);
  console.log(`   Tanque 2 (nuevo): ${JSON.stringify(c.tanque2)} + modelo, capacidad y válvulas del tanque 1`);
  cambios++;
  if (!aplicar) continue;

  await prisma.$transaction([
    prisma.stationTankTechnicalSheet.update({ where: { id: t1.id }, data: c.tanque1 }),
    prisma.stationTankTechnicalSheet.create({
      data: { vehicleRecordId: estacion.id, etiqueta: "Tanque 2", ...copia, ...c.tanque2 },
    }),
    prisma.activityLog.create({
      data: {
        accion: "EDITAR",
        entidad: "Ficha técnica del tanque",
        resumen: `${c.estacion}: se separaron los dos tanques que estaban juntos en una sola ficha`,
        detalle: `Tanque 1: ${JSON.stringify(c.junto)} -> ${JSON.stringify(c.tanque1)}. Tanque 2 nuevo: ${JSON.stringify(c.tanque2)} (válvulas copiadas del tanque 1).`,
        citySlug: estacion.section.city.slug,
        username: "sistema (separar-tanques-estaciones)",
      },
    }),
  ]);
  console.log("   Guardado.");
}

console.log(aplicar ? `\nListo: ${cambios} estación(es) separada(s).` : `\nSimulación: ${cambios} estación(es) por separar. Corre con --apply para guardar.`);
await prisma.$disconnect();
