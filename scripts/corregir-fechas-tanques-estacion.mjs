// Corrige lo que quedó del import de "Equipos principales Estaciones.xlsx"
// (ver scripts/import-equipos-estaciones.mjs): la columna "AÑO" del Excel en
// realidad trae mes y año en varias estaciones ("10 96" = octubre de 1996,
// "03 14" = marzo de 2014, etc — dos dígitos de año: 00-29 -> 20XX, 30-99 ->
// 19XX, igual que ya venía interpretando el equipo). Cuando sí trae mes, se
// guarda como fechaFabricacion (día 1 de ese mes); cuando solo trae año, se
// deja como texto en anioFabricacion.
//
// Además, en las estaciones con dos tanques, el número de serie más grande
// debe corresponder a la fabricación más reciente (mismo fabricante, series
// consecutivas) — así lo indicó el usuario. Quiroga y Palo Verde tenían la
// pareja cruzada; se corrige aquí.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

// { numeroEconomico, etiqueta, fechaFabricacion: [año, mes] | null, anioFabricacion }
const CORRECCIONES = [
  // Quiroga: serie mayor (V-767) debe llevar el año más reciente. Sin mes
  // en el Excel para esta, solo año.
  { numeroEconomico: "Quiroga", etiqueta: "Tanque 1", anioFabricacion: "2002" }, // V-760 (menor)
  { numeroEconomico: "Quiroga", etiqueta: "Tanque 2", anioFabricacion: "2006" }, // V-767 (mayor)

  // Palo Verde: serie mayor (A-370) debe llevar el año más reciente. "00" es
  // 2000, claro; "43" no calza como mes+año ni es un año creíble para un
  // tanque en servicio — se deja tal cual, marcado para revisar a mano.
  { numeroEconomico: "Palo Verde", etiqueta: "Tanque 1", anioFabricacion: "2000" }, // A-370 (mayor)
  { numeroEconomico: "Palo Verde", etiqueta: "Tanque 2", anioFabricacion: "43 (revisar)" }, // A-368 (menor)

  // Parque Industrial: mes y año en los dos, y ya coinciden con la regla de
  // la serie (9 55, la mayor, es la más reciente) — solo se convierte a fecha.
  { numeroEconomico: "P. Indust", etiqueta: "Tanque 1", fechaFabricacion: [1996, 10], anioFabricacion: "1996" },
  { numeroEconomico: "P. Indust", etiqueta: "Tanque 2", fechaFabricacion: [1998, 8], anioFabricacion: "1998" },

  // Pitic: solo año, sin mes. Series "766" y "8 11" no se pueden comparar de
  // forma confiable, así que se deja el orden tal cual venía.
  { numeroEconomico: "Pitic", etiqueta: "Tanque 1", anioFabricacion: "1997" },
  { numeroEconomico: "Pitic", etiqueta: "Tanque 2", anioFabricacion: "1996" },

  // Calle 12: mismo año para los dos tanques, solo se completa a 4 dígitos.
  { numeroEconomico: "Calle 12", etiqueta: "Tanque 1", anioFabricacion: "1999" },
  { numeroEconomico: "Calle 12", etiqueta: "Tanque 2", anioFabricacion: "1999" },

  // Reforma: mes y año en los dos; el orden ya venía consistente con la regla
  // de la serie (si "11 82" > "228").
  { numeroEconomico: "Reforma", etiqueta: "Tanque 1", fechaFabricacion: [1997, 2], anioFabricacion: "1997" },
  { numeroEconomico: "Reforma", etiqueta: "Tanque 2", fechaFabricacion: [1999, 9], anioFabricacion: "1999" },

  // Sufragio: "45"/"43" no son meses válidos (no hay mes 45 ni 43) — se deja
  // el texto tal cual vino del Excel, marcado para que alguien lo revise en
  // el documento original.
  { numeroEconomico: "Sufragio", etiqueta: "Tanque 1", anioFabricacion: "45 00 (revisar)" },
  { numeroEconomico: "Sufragio", etiqueta: "Tanque 2", anioFabricacion: "43 00 (revisar)" },

  // Un solo tanque, mes y año claros.
  { numeroEconomico: "CTM", etiqueta: "Tanque 1", fechaFabricacion: [2014, 3], anioFabricacion: "2014" },
  { numeroEconomico: "Minitas", etiqueta: "Tanque 1", fechaFabricacion: [2013, 4], anioFabricacion: "2013" },
  { numeroEconomico: "Haciendas del Sur", etiqueta: "Tanque 1", fechaFabricacion: [2018, 10], anioFabricacion: "2018" },
];

let actualizados = 0;
for (const c of CORRECCIONES) {
  const record = await prisma.vehicleRecord.findFirst({
    where: {
      numeroEconomico: c.numeroEconomico,
      section: { slug: { in: ["estaciones-de-carburacion", "planta-ficha-tecnica"] } },
    },
    select: { id: true },
  });
  if (!record) {
    console.log(`OMITIDO ${c.numeroEconomico}: no se encontró`);
    continue;
  }

  const data = { anioFabricacion: c.anioFabricacion };
  if (c.fechaFabricacion) {
    const [anio, mes] = c.fechaFabricacion;
    data.fechaFabricacion = new Date(Date.UTC(anio, mes - 1, 1));
  }

  console.log(
    `${c.numeroEconomico} (${c.etiqueta}): anioFabricacion="${data.anioFabricacion}"` +
      (data.fechaFabricacion ? ` fechaFabricacion=${data.fechaFabricacion.toISOString().slice(0, 10)}` : "")
  );

  if (!DRY_RUN) {
    await prisma.stationTankTechnicalSheet.update({
      where: { vehicleRecordId_etiqueta: { vehicleRecordId: record.id, etiqueta: c.etiqueta } },
      data,
    });
    actualizados++;
  }
}

console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Tanques corregidos: ${actualizados}`);
await prisma.$disconnect();
