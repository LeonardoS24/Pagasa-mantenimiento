// Importa equipos y datos de tanque de "Equipos principales Estaciones.xlsx"
// (17 estaciones: 15 en Hermosillo, CTM y Sufragio en Cajeme). Los rangos de
// fila de cada bloque se sacaron leyendo el Excel completo a mano (no tiene
// una estructura uniforme: algunas no tienen renglón "DESCRIPCION", otras
// tienen renglones de nota o "10%" sin datos útiles, así que un parser
// genérico habría adivinado mal en varios casos).
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const prisma = new PrismaClient();
const EXCEL = "C:/Users/Leonardo Silvas/Documents/Pagasa/Equipos/Equipos principales Estaciones.xlsx";
const DRY_RUN = process.argv.includes("--dry-run");

const rows = XLSX.utils.sheet_to_json(XLSX.readFile(EXCEL).Sheets["Hoja1"], {
  header: 1,
  defval: "",
  raw: false,
});

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();
const limpio = (v) => {
  const t = norm(v);
  return t === "" || t === "0" ? null : t;
};

const TIPO_POR_FILA = {
  LITROMETRO: "MECANICO",
  REGISTRO: "ELECTRICO",
  BOMBA: "MECANICO",
  MOTOR: "ELECTRICO",
  MANGUERA: "MECANICO",
  MANOMETRO: "MECANICO",
  TERMOMETRO: "MECANICO",
  EXTINTORES: "AUXILIAR",
};
const NOMBRE_POR_FILA = {
  LITROMETRO: "Litrómetro",
  REGISTRO: "Registro (UDS)",
  BOMBA: "Bomba",
  MOTOR: "Motor",
  MANGUERA: "Manguera",
  MANOMETRO: "Manómetro",
  TERMOMETRO: "Termómetro",
  EXTINTORES: "Extintor",
};

function tipoFilaDe(rawNombre) {
  const u = norm(rawNombre).toUpperCase();
  if (u.startsWith("LITROMETRO")) return "LITROMETRO";
  if (u.startsWith("REGISTRO")) return "REGISTRO";
  if (u.startsWith("BOMBA")) return "BOMBA";
  if (u.startsWith("MOTOR")) return "MOTOR";
  if (u.startsWith("MANGUERA")) return "MANGUERA";
  if (u.startsWith("MANOMETRO")) return "MANOMETRO";
  if (u.startsWith("TERMOMETRO")) return "TERMOMETRO";
  if (u.startsWith("EXTINT") || u.startsWith("EXTING")) return "EXTINTORES";
  return null;
}

// numeroEconomico -> fila del tanque (índice 0-based en `rows`) + filas de
// equipo a importar (null tanqueRow = esa estación no trae renglón de
// tanque en este Excel, ya tiene sus datos de una importación anterior).
const ESTACIONES = [
  { numeroEconomico: "Musaro", tanqueRow: 2, equipoRows: [3, 4, 5, 6, 7, 8, 9, 10] },
  { numeroEconomico: "Quiroga", tanqueRow: 15, equipoRows: [16, 17, 18, 19, 20, 21, 22], dosTanques: true },
  { numeroEconomico: "Palo Verde", tanqueRow: 26, equipoRows: [27, 28, 29, 30, 31, 32, 33, 35], dosTanques: true },
  { numeroEconomico: "P. Indust", tanqueRow: 39, equipoRows: [40, 41, 42, 43, 44, 48], dosTanques: true },
  { numeroEconomico: "Pitic", tanqueRow: 54, equipoRows: [55, 56, 57, 58, 59, 63], dosTanques: true },
  { numeroEconomico: "Calle 12", tanqueRow: 67, equipoRows: [68, 69, 70, 71, 72, 73, 74, 76], dosTanques: true },
  { numeroEconomico: "Quiroga Nte", tanqueRow: 84, equipoRows: [85, 86, 87, 88, 89, 94] },
  { numeroEconomico: "Encinas", tanqueRow: 98, equipoRows: [99, 100, 101, 102, 103, 104, 105, 107] },
  { numeroEconomico: "Lienzo Charro", tanqueRow: null, equipoRows: [112, 113, 114, 115, 116, 117, 118, 120] },
  { numeroEconomico: "Haciendas del Sur", tanqueRow: 126, equipoRows: [127, 128, 129, 130, 131, 132, 133, 135] },
  { numeroEconomico: "Minitas", tanqueRow: 141, equipoRows: [142, 143, 144, 145, 146, 147, 148, 150] },
  { numeroEconomico: "Quintero Arce", tanqueRow: 156, equipoRows: [157, 158, 159, 160, 161, 162, 163, 165] },
  { numeroEconomico: "Reforma", tanqueRow: 170, equipoRows: [171, 172, 173, 174, 175, 176, 177, 179], dosTanques: true },
  { numeroEconomico: "Pueblitos", tanqueRow: 185, equipoRows: [186, 187, 188, 189, 190, 191, 192, 194] },
  { numeroEconomico: "Villa de Seris", tanqueRow: 200, equipoRows: [201, 202, 203, 204, 205, 206, 207, 209] },
  { numeroEconomico: "CTM", tanqueRow: 216, equipoRows: [217, 218, 221, 224] },
  { numeroEconomico: "Sufragio", tanqueRow: 231, equipoRows: [], dosTanques: true },
];

// Serie/año de cada tanque, separados a mano para las 7 estaciones con dos
// tanques físicos (el Excel los trae juntos en una sola celda, con
// separadores distintos en cada una: coma, " y ", "_", etc).
const TANQUES_DOBLES = {
  Quiroga: [
    { etiqueta: "Tanque 1", numeroSerie: "V-760", anioFabricacion: "06" },
    { etiqueta: "Tanque 2", numeroSerie: "V-767", anioFabricacion: "02" },
  ],
  "Palo Verde": [
    { etiqueta: "Tanque 1", numeroSerie: "A-370", anioFabricacion: "43" },
    { etiqueta: "Tanque 2", numeroSerie: "A-368", anioFabricacion: "00" },
  ],
  "P. Indust": [
    { etiqueta: "Tanque 1", numeroSerie: "8 09", anioFabricacion: "10 96" },
    { etiqueta: "Tanque 2", numeroSerie: "9 55", anioFabricacion: "8 98" },
  ],
  Pitic: [
    { etiqueta: "Tanque 1", numeroSerie: "766", anioFabricacion: "97" },
    { etiqueta: "Tanque 2", numeroSerie: "8 11", anioFabricacion: "96" },
  ],
  "Calle 12": [
    { etiqueta: "Tanque 1", numeroSerie: "1615", anioFabricacion: "99" },
    { etiqueta: "Tanque 2", numeroSerie: "1620", anioFabricacion: "99" },
  ],
  Reforma: [
    { etiqueta: "Tanque 1", numeroSerie: "228", anioFabricacion: "02 97" },
    { etiqueta: "Tanque 2", numeroSerie: "11 82", anioFabricacion: "09 99" },
  ],
  Sufragio: [
    { etiqueta: "Tanque 1", numeroSerie: "A 372", anioFabricacion: "45 00" },
    { etiqueta: "Tanque 2", numeroSerie: "A 369", anioFabricacion: "43 00" },
  ],
};

let tanquesActualizados = 0;
let tanquesCreados = 0;
let equiposCreados = 0;
let equiposOmitidos = 0;

for (const est of ESTACIONES) {
  const record = await prisma.vehicleRecord.findFirst({
    where: {
      numeroEconomico: est.numeroEconomico,
      section: { slug: { in: ["estaciones-de-carburacion", "planta-ficha-tecnica"] } },
    },
    select: { id: true, numeroEconomico: true, sectionId: true, section: { select: { city: { select: { name: true } } } } },
  });
  if (!record) {
    console.log(`OMITIDA ${est.numeroEconomico}: no se encontró en la BD`);
    continue;
  }
  const etiquetaCiudad = `${record.section.city.name} / ${record.numeroEconomico}`;

  // --- Ficha(s) del tanque ---
  if (est.tanqueRow !== null) {
    const t = rows[est.tanqueRow];
    const comunes = { capacidad: limpio(t[1]), marca: limpio(t[5]), modelo: limpio(t[6]) };

    if (est.dosTanques) {
      const split = TANQUES_DOBLES[est.numeroEconomico];
      for (const tanque of split) {
        const datos = { ...comunes, numeroSerie: tanque.numeroSerie, anioFabricacion: tanque.anioFabricacion };
        console.log(`TANQUE ${etiquetaCiudad} (${tanque.etiqueta}):`, datos);
        if (!DRY_RUN) {
          const existia = await prisma.stationTankTechnicalSheet.findUnique({
            where: { vehicleRecordId_etiqueta: { vehicleRecordId: record.id, etiqueta: tanque.etiqueta } },
          });
          await prisma.stationTankTechnicalSheet.upsert({
            where: { vehicleRecordId_etiqueta: { vehicleRecordId: record.id, etiqueta: tanque.etiqueta } },
            update: datos,
            create: { vehicleRecordId: record.id, etiqueta: tanque.etiqueta, ...datos },
          });
          existia ? tanquesActualizados++ : tanquesCreados++;
        }
      }
    } else {
      const datos = { ...comunes, numeroSerie: limpio(t[4]), anioFabricacion: limpio(t[3]) };
      console.log(`TANQUE ${etiquetaCiudad} (Tanque 1):`, datos);
      if (!DRY_RUN) {
        const existia = await prisma.stationTankTechnicalSheet.findUnique({
          where: { vehicleRecordId_etiqueta: { vehicleRecordId: record.id, etiqueta: "Tanque 1" } },
        });
        // Solo llena huecos en la ficha que ya existe (no se pisa nada
        // capturado a mano); si no existe todavía, se crea completa.
        const update = existia
          ? Object.fromEntries(Object.entries(datos).filter(([k, v]) => v !== null && existia[k] == null))
          : datos;
        await prisma.stationTankTechnicalSheet.upsert({
          where: { vehicleRecordId_etiqueta: { vehicleRecordId: record.id, etiqueta: "Tanque 1" } },
          update,
          create: { vehicleRecordId: record.id, etiqueta: "Tanque 1", ...datos },
        });
        existia ? tanquesActualizados++ : tanquesCreados++;
      }
    }
  }

  // --- Equipos ---
  for (const idx of est.equipoRows) {
    const r = rows[idx];
    const tipoFila = tipoFilaDe(r[0]);
    if (!tipoFila) {
      console.log(`  ! fila ${idx} de ${est.numeroEconomico} no reconocida: "${r[0]}"`);
      continue;
    }
    let capacidad = limpio(r[1]);
    const cantidadTexto = limpio(r[2]);
    let anioFabricacion = limpio(r[3]);
    const numeroSerie = limpio(r[4]);
    const marca = limpio(r[5]);
    const modelo = limpio(r[6]);

    // Manómetro/Termómetro: en estas dos filas la columna "capacidad" en
    // realidad es "sí/no hay uno instalado" (no un tamaño) y la de "año" es
    // un residuo sin sentido ("1"/"0") — no se leen igual que en el resto.
    let notaInstalado = null;
    if (tipoFila === "MANOMETRO" || tipoFila === "TERMOMETRO") {
      if (capacidad && /^(si|sí|no)$/i.test(capacidad)) {
        notaInstalado = /^(si|sí)$/i.test(capacidad) ? "Instalado" : null;
        capacidad = null;
      }
      anioFabricacion = null;
    }

    // Fila sin ningún dato real más allá de la cantidad: no aporta nada,
    // mejor dejarla para captura a mano que crear un equipo vacío.
    if (!capacidad && !anioFabricacion && !numeroSerie && !marca && !modelo && !notaInstalado) {
      equiposOmitidos++;
      continue;
    }

    const cantidadNum = cantidadTexto ? Number(cantidadTexto) : null;
    const notaCantidad =
      cantidadNum && Number.isInteger(cantidadNum) && cantidadNum > 1 ? `Cantidad: ${cantidadNum}` : null;
    const observaciones = [notaInstalado, notaCantidad].filter(Boolean).join(" · ") || null;

    const datos = {
      sectionId: record.sectionId,
      vehicleRecordId: record.id,
      tipoEquipo: TIPO_POR_FILA[tipoFila],
      nombre: NOMBRE_POR_FILA[tipoFila],
      capacidad,
      anioFabricacion,
      numeroSerie,
      marca,
      modelo,
      observaciones,
    };
    console.log(`EQUIPO ${etiquetaCiudad}: ${datos.nombre}`, {
      capacidad,
      anioFabricacion,
      numeroSerie,
      marca,
      modelo,
      observaciones,
    });

    if (!DRY_RUN) {
      const yaExiste = await prisma.equipo.findFirst({
        where: { vehicleRecordId: record.id, nombre: datos.nombre },
      });
      if (yaExiste) {
        console.log(`  (ya existe, se omite)`);
        continue;
      }
      const maxOrder = await prisma.equipo.aggregate({
        where: { sectionId: record.sectionId, vehicleRecordId: record.id },
        _max: { order: true },
      });
      await prisma.equipo.create({ data: { ...datos, order: (maxOrder._max.order ?? -1) + 1 } });
      equiposCreados++;
    }
  }
}

console.log(`\n${DRY_RUN ? "[DRY RUN] " : ""}Tanques actualizados: ${tanquesActualizados}`);
console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Tanques creados: ${tanquesCreados}`);
console.log(`${DRY_RUN ? "[DRY RUN] " : ""}Equipos creados: ${equiposCreados}`);
console.log(`Filas de equipo sin datos útiles (omitidas): ${equiposOmitidos}`);

await prisma.$disconnect();
