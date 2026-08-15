// Las fechas de cambio de válvulas de las estaciones vinieron de un Excel
// distinto ("Fechas de valvulas.xls", importado antes de que existiera el
// concepto de "Tanque 2" — ver scripts/import-station-tanks-from-excel.mjs)
// con un solo juego de fechas por estación, no uno por tanque físico. El
// usuario confirmó que cuando solo hay un juego, aplica igual a los dos
// tanques — así que se copian de "Tanque 1" a "Tanque 2" en las 7 estaciones
// que tienen dos tanques.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const CAMPOS_VALVULAS = [
  "fechaInstalacionValvulas",
  "fechaFabricacionValvulaExcesoFlujo",
  "fechaFabricacionValvulaNoRetroceso",
  "fechaFabricacionValvulaSeguridad",
  "fechaFabricacionValvulaLlenado",
  "fechaFabricacionValvulaServicio",
  "fechaFabricacionValvulaCheckLock",
  "fechaFabricacionValvulaVapor",
];

const ESTACIONES_DOS_TANQUES = ["Quiroga", "Palo Verde", "P. Indust", "Pitic", "Calle 12", "Reforma", "Sufragio"];

let actualizadas = 0;

for (const numeroEconomico of ESTACIONES_DOS_TANQUES) {
  const estacion = await prisma.vehicleRecord.findFirst({
    where: { numeroEconomico, section: { slug: "estaciones-de-carburacion" } },
    select: {
      stationTankTechnicalSheets: {
        where: { etiqueta: { in: ["Tanque 1", "Tanque 2"] } },
      },
    },
  });
  const tanque1 = estacion?.stationTankTechnicalSheets.find((t) => t.etiqueta === "Tanque 1");
  const tanque2 = estacion?.stationTankTechnicalSheets.find((t) => t.etiqueta === "Tanque 2");
  if (!tanque1 || !tanque2) {
    console.log(`OMITIDA ${numeroEconomico}: faltan Tanque 1 o Tanque 2`);
    continue;
  }

  const valvulas1 = Object.fromEntries(CAMPOS_VALVULAS.map((c) => [c, tanque1[c]]));
  const tieneAlgo = Object.values(valvulas1).some((v) => v !== null);
  if (!tieneAlgo) {
    console.log(`OMITIDA ${numeroEconomico}: Tanque 1 tampoco tiene fechas de válvulas`);
    continue;
  }

  console.log(
    `${numeroEconomico}: copiando a Tanque 2 -> ` +
      Object.entries(valvulas1)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => `${k}=${v.toISOString().slice(0, 10)}`)
        .join(", ")
  );

  if (!DRY_RUN) {
    await prisma.stationTankTechnicalSheet.update({
      where: { id: tanque2.id },
      data: valvulas1,
    });
    actualizadas++;
  }
}

console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Tanque 2 actualizados: ${actualizadas}`);
await prisma.$disconnect();
