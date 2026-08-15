// Llena la "Ficha técnica del tanque" (StationTankTechnicalSheet) de cada
// Estación de carburación con los datos de la hoja "Dat. Carbs" del archivo
// "Fechas de valvulas.xls" (relación de tanques y válvulas que lleva el
// equipo desde antes de este sistema).
//
// De la fila "TANQUES" de cada estación se toman: capacidad, año de
// fabricación, número de serie, marca y modelo. El resto de los campos de la
// ficha (presión de diseño, espesores, materiales, etc.) no vienen en ese
// Excel y se dejan vacíos para capturarse a mano.
//
// Estaciones cuyo bloque de equipo en el Excel es copia idéntica de otra
// estación (mismo tanque, litrómetro, bomba, motor y serie): se saltan a
// propósito, porque ese dato no es suyo — ver DUPLICADAS abajo.
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const prisma = new PrismaClient();
const EXCEL = "C:/Users/Leonardo Silvas/Downloads/Fechas de valvulas.xls";

// Nombre del bloque en el Excel -> numeroEconomico del registro en la BD.
// Las que no aparecen aquí es porque no existen como estación en el sistema
// (Lázaro Cárdenas, Mascareña, San Felipe, Centinela, Empalme, Pesqueira,
// Contreras) o porque no vienen en el Excel ("5 de Mayo", Nogales).
const MAPEO = {
  MUSARO: "Musaro",
  'ESTACIONES HERMOSILLO " QUIROGA"': "Quiroga",
  'ESTACIONES HERMOSILLO " PALOVERDE"': "Palo Verde",
  'ESTACIONES HILLO. " PARQUE INDUSTRIAL "': "P. Indust",
  'ESTACIONES HERMOSILLO " PITIC "': "Pitic",
  'ESTACIONES HERMOSILLO " CALLE12 "': "Calle 12",
  'ESTACIONES HERMOSILLO " QUIROGA NORTE "': "Quiroga Nte",
  'ESTACIONES HERMOSILLO " LUIS ENCINAS "': "Encinas",
  'ESTACIONES HERMOSILLO " LIENZO CHARRO "': "Lienzo Charro",
  'ESTACION HERMOSILLO " HACIENDAS DEL SUR "': "Haciendas del Sur",
  'ESTACIONES HERMOSILLO " MINITAS "': "Minitas",
  'ESTACION HERMOSILLO " QUINTERO ARCE "': "Quintero Arce",
  'ESTACION HERMOSILLO " PUEBLITOS "': "Pueblitos",
  'ESTACION HERMOSILLO " VILLA DE SERIS "': "Villa de Seris",
  "ESTACION CTM": "CTM",
  "ESTACION SUFRAGIO": "Sufragio",
  "ESTACION NORMAN BORLAUG 1815": "Bourlaug II",
  'ESTACIONES NAVOJOA "PERIFERICO SUR"': "Perisur",
  "ESTACION PAGASITA": "Pagasita",
  "ESTACION NUEVO ROBLEDO": "Robledo",
  "ESTACION SAN PEDRO MEZQUITAL": "San Pedro Mezquital",
  "ESTACION OAXACA": "Oaxaca",
  "ESTACION DELTA": "Delta",
  "ESTACION SANTO TOMAS": "Sto Tomas",
};

// Bloques del Excel cuyo renglón de equipo está copiado de otra estación
// (serie "228 ,11 82", año "02 97,| 09 99", litrómetro MX1638, bomba 14 AVH,
// motor H99TN447 3 — idénticos en 6 estaciones distintas). No se importan:
// hay que capturarlos a mano con el dato real de cada una.
const DUPLICADAS = new Set([
  'ESTACION HERMOSILLO " REFORMA "',
  'ESTACION NOGALES " ALAMOS "',
  'ESTACION NOGALES " COLINAS "',
]);

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const limpio = (v) => {
  const t = norm(v);
  // El Excel usa "0" como "sin dato" en varias columnas.
  return t === "" || t === "0" ? null : t;
};

function isStationHeader(r) {
  const a = norm(r[0]).toUpperCase();
  if (!a) return false;
  if (a === "MUSARO") return true;
  return /^(ESTACION|ESTACIONES)\b/.test(a);
}

const rows = XLSX.utils.sheet_to_json(XLSX.readFile(EXCEL).Sheets["Dat. Carbs"], {
  header: 1,
  defval: "",
  raw: false,
});

const bloques = [];
rows.forEach((r, i) => {
  if (isStationHeader(r)) bloques.push({ start: i, name: norm(r[0]) });
});
bloques.forEach((b, i) => {
  b.end = i + 1 < bloques.length ? bloques[i + 1].start : rows.length;
});

let actualizadas = 0;
const saltadas = [];

for (const b of bloques) {
  if (DUPLICADAS.has(b.name)) {
    saltadas.push(`${b.name} (bloque de equipo duplicado en el Excel)`);
    continue;
  }
  const numeroEconomico = MAPEO[b.name];
  if (!numeroEconomico) {
    saltadas.push(`${b.name} (sin estación equivalente en el sistema)`);
    continue;
  }

  // La fila del tanque es la que sigue al encabezado "DESCRIPCION ...".
  let tanque = null;
  for (let i = b.start; i < b.end && !tanque; i++) {
    if (!/^DESCRIPCION/i.test(norm(rows[i][0]))) continue;
    for (let j = i + 1; j < Math.min(i + 4, b.end); j++) {
      if (/^TANQUES?\b/i.test(norm(rows[j][0]))) {
        tanque = rows[j];
        break;
      }
    }
  }
  if (!tanque) {
    saltadas.push(`${b.name} (sin renglón de TANQUES)`);
    continue;
  }

  const record = await prisma.vehicleRecord.findFirst({
    where: {
      numeroEconomico,
      section: { slug: { in: ["estaciones-de-carburacion", "planta-ficha-tecnica"] } },
    },
    select: { id: true, numeroEconomico: true, section: { select: { city: { select: { name: true } } } } },
  });
  if (!record) {
    saltadas.push(`${b.name} -> "${numeroEconomico}" (no se encontró en la BD)`);
    continue;
  }

  const datos = {
    capacidad: limpio(tanque[1]),
    anioFabricacion: limpio(tanque[3]),
    numeroSerie: limpio(tanque[4]),
    marca: limpio(tanque[5]),
    modelo: limpio(tanque[6]),
  };

  await prisma.stationTankTechnicalSheet.upsert({
    where: { vehicleRecordId: record.id },
    update: datos,
    create: { vehicleRecordId: record.id, ...datos },
  });
  actualizadas++;
  console.log(
    `OK ${record.section.city.name} / ${record.numeroEconomico}: ` +
      `cap=${datos.capacidad} año=${datos.anioFabricacion} serie=${datos.numeroSerie} ` +
      `marca=${datos.marca} modelo=${datos.modelo}`
  );
}

console.log(`\nFichas de tanque llenadas: ${actualizadas}`);
console.log("Saltadas:");
saltadas.forEach((s) => console.log(" -", s));

await prisma.$disconnect();
