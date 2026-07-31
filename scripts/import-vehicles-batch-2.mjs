// Importa datos de vehículos (Auto-Tanques y Vehículo con tanque de
// carburación) de Tijuana, Guaymas, Cajeme (Ciudad Obregón), Mexicali y
// Nogales, a partir de los Excel proporcionados. Hermosillo se dejó fuera
// porque su Excel coincide exactamente con lo que ya existe en la base de
// datos (importado en una restructuración anterior).
//
// Cada archivo tiene un formato distinto (columnas en diferente orden,
// bloques con/sin encabezado, filas mal alineadas por captura manual), así
// que el mapeo de columnas está resuelto por archivo/bloque en vez de un
// parser genérico. Los registros se agrupan por número económico
// normalizado dentro de cada (ciudad, sub-apartado) para fusionar datos
// repetidos entre bloques/hojas del mismo archivo antes de escribir en la
// base de datos.
import XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DIR = "C:\\Users\\Leonardo Silvas\\Documents\\Pagasa\\Autos Hermosillo";
const DRY_RUN = process.argv.includes("--dry");

function excelSerialToDate(v) {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") {
    if (v <= 0) return null;
    if (v > 20000 && v < 60000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000);
    if (v >= 1990 && v <= 2100) return new Date(Date.UTC(v, 0, 1));
    return null;
  }
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t.toUpperCase() === "N/A") return null;
    const m = t.match(/(\d{1,2})\/+(\d{1,2})\/+(\d{4})/);
    if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    const parsed = Date.parse(t);
    if (!isNaN(parsed)) return new Date(parsed);
    return null;
  }
  return null;
}

function cleanText(v) {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (!t || t.toUpperCase() === "N/A" || t === "-") return null;
  return t;
}

function normEco(v) {
  return String(v ?? "").trim().toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}

function normPlaca(v) {
  return String(v ?? "").trim().toUpperCase().replace(/[\s-]/g, "");
}

function readRows(file, sheetName) {
  const wb = XLSX.readFile(`${DIR}\\${file}`);
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
}

function pushEntry(list, entry) {
  if (!entry.numeroEconomico) return;
  list.push(entry);
}

// ---------- Recolección de candidatos por archivo ----------
const candidates = []; // { citySlug, sectionSlug, numeroEconomico, sucursal, anio, placas, numeroAnterior, localidadAnterior, sheet: {...} }

// ===== TIJUANA =====
{
  const rows = readRows("Aunto-Tanques  y carburados Tijuana.xlsx", "Hoja1");
  for (let i = 2; i <= 19; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    pushEntry(candidates, {
      citySlug: "tijuana",
      sectionSlug: "auto-tanques",
      numeroEconomico: cleanText(r[0]),
      sucursal: cleanText(r[1]),
      anio: cleanText(r[2]),
      placas: cleanText(r[3]),
      numeroAnterior: cleanText(r[12]),
      localidadAnterior: null,
      sheet: {
        serie: cleanText(r[4]),
        marcaTanque: cleanText(r[5]),
        capacidadTanque: cleanText(r[6]),
        numeroSerieTanque: cleanText(r[7]),
        anioFabricacionTanque: cleanText(r[8]),
        numeroUltimoUltrasonido: cleanText(r[9]),
        ultimoUltrasonido: excelSerialToDate(r[10]),
        fechaProximoUltrasonido: excelSerialToDate(r[11]),
      },
    });
  }
  for (let i = 23; i <= 31; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    pushEntry(candidates, {
      citySlug: "tijuana",
      sectionSlug: "vehiculo-con-tanque-de-carburacion",
      numeroEconomico: cleanText(r[0]),
      sucursal: cleanText(r[1]),
      anio: cleanText(r[2]),
      placas: cleanText(r[3]),
      numeroAnterior: null,
      localidadAnterior: null,
      sheet: {
        serie: cleanText(r[4]),
        marcaTanque: cleanText(r[5]),
        capacidadTanque: cleanText(r[6]),
        numeroSerieTanque: cleanText(r[7]),
        anioFabricacionTanque: cleanText(r[8]),
        numeroUltimoUltrasonido: cleanText(r[9]),
        ultimoUltrasonido: excelSerialToDate(r[10]),
        fechaProximoUltrasonido: excelSerialToDate(r[11]),
      },
    });
  }
}

// ===== GUAYMAS =====
{
  const rows1 = readRows("Auto-Tanque y carburados Guaymas.xlsx", "Hoja1");
  function parseNormalBlock(rows, from, to, sectionSlug) {
    for (let i = from; i <= to; i++) {
      const r = rows[i];
      if (!r || !r[2]) continue;
      if (typeof r[2] === "number") {
        // fila desplazada: faltan las columnas "anterior"
        pushEntry(candidates, {
          citySlug: "guaymas",
          sectionSlug,
          numeroEconomico: cleanText(r[0]),
          sucursal: cleanText(r[1]),
          anio: cleanText(r[2]),
          placas: cleanText(r[3]),
          numeroAnterior: null,
          localidadAnterior: null,
          sheet: { serie: cleanText(r[4]) },
        });
      } else {
        pushEntry(candidates, {
          citySlug: "guaymas",
          sectionSlug,
          numeroEconomico: cleanText(r[2]),
          sucursal: cleanText(r[3]),
          anio: cleanText(r[4]),
          placas: cleanText(r[5]),
          numeroAnterior: cleanText(r[0]),
          localidadAnterior: cleanText(r[1]),
          sheet: {},
        });
      }
    }
  }
  parseNormalBlock(rows1, 3, 6, "auto-tanques");
  parseNormalBlock(rows1, 10, 14, "vehiculo-con-tanque-de-carburacion");

  const rows2 = readRows("Auto-Tanque y carburados Guaymas.xlsx", "Guaymas Todo Repetido");
  function parseRepetidoBlock(rows, from, to, sectionSlug) {
    for (let i = from; i <= to; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      const shifted = typeof r[5] === "number" && r[5] > 0;
      const eco = cleanText(r[0]);
      let placas = cleanText(r[3]);
      let entry;
      if (shifted) {
        entry = {
          numeroEconomico: eco,
          sucursal: cleanText(r[1]),
          anio: cleanText(r[2]),
          placas,
          serie: cleanText(r[4]),
          capacidadTanque: cleanText(r[5]),
          marcaTanque: cleanText(r[6]),
          anioFabricacionTanque: cleanText(r[7]),
          numeroSerieTanque: cleanText(r[8]),
          numeroUltimoUltrasonido: cleanText(r[9]),
          ultimoUltrasonido: excelSerialToDate(r[10]),
          fechaProximoUltrasonido: excelSerialToDate(r[11]),
        };
      } else {
        entry = {
          numeroEconomico: eco,
          sucursal: cleanText(r[1]),
          anio: cleanText(r[2]),
          placas,
          serie: cleanText(r[4]),
          capacidadTanque: cleanText(r[6]),
          marcaTanque: cleanText(r[7]),
          anioFabricacionTanque: cleanText(r[8]),
          numeroSerieTanque: cleanText(r[9]),
          numeroUltimoUltrasonido: cleanText(r[10]),
          ultimoUltrasonido: excelSerialToDate(r[11]),
          fechaProximoUltrasonido: excelSerialToDate(r[12]),
        };
      }
      // "s" es un typo de captura: reconciliar por placas contra un candidato ya conocido
      if (entry.numeroEconomico.length <= 2) {
        const match = candidates.find(
          (c) => c.citySlug === "guaymas" && c.placas && normPlaca(c.placas) === normPlaca(placas)
        );
        if (match) entry.numeroEconomico = match.numeroEconomico;
      }
      pushEntry(candidates, {
        citySlug: "guaymas",
        sectionSlug,
        numeroEconomico: entry.numeroEconomico,
        sucursal: entry.sucursal,
        anio: entry.anio,
        placas: entry.placas,
        numeroAnterior: null,
        localidadAnterior: null,
        sheet: {
          serie: entry.serie,
          capacidadTanque: entry.capacidadTanque,
          marcaTanque: entry.marcaTanque,
          anioFabricacionTanque: entry.anioFabricacionTanque,
          numeroSerieTanque: entry.numeroSerieTanque,
          numeroUltimoUltrasonido: entry.numeroUltimoUltrasonido,
          ultimoUltrasonido: entry.ultimoUltrasonido,
          fechaProximoUltrasonido: entry.fechaProximoUltrasonido,
        },
      });
    }
  }
  parseRepetidoBlock(rows2, 1, 4, "auto-tanques");
  parseRepetidoBlock(rows2, 9, 13, "vehiculo-con-tanque-de-carburacion");
}

// ===== CIUDAD OBREGÓN (Cajeme) =====
{
  const rows = readRows("Auto-Tanques Ciudad Obregon.xlsx", "Hoja1");
  function parseBlock(from, to) {
    for (let i = from; i <= to; i++) {
      const r = rows[i];
      if (!r || !r[0]) continue;
      pushEntry(candidates, {
        citySlug: "cajeme-ciudad-obregon",
        sectionSlug: "auto-tanques",
        numeroEconomico: cleanText(r[0]),
        sucursal: cleanText(r[1]),
        anio: cleanText(r[2]),
        placas: cleanText(r[3]),
        numeroAnterior: cleanText(r[14]),
        localidadAnterior: null,
        sheet: {
          serie: cleanText(r[4]),
          capacidadTanque: cleanText(r[5]),
          marcaTanque: cleanText(r[6]),
          anioFabricacionTanque: cleanText(r[7]),
          numeroSerieTanque: cleanText(r[8]),
          numeroUltimoUltrasonido: cleanText(r[9]),
          ultimoUltrasonido: excelSerialToDate(r[10]),
          fechaProximoUltrasonido: excelSerialToDate(r[11]),
        },
      });
    }
  }
  parseBlock(3, 9);
  parseBlock(14, 18);
}

// ===== MEXICALI =====
// Omitido en este run: el archivo cambió entre la primera inspección y la
// importación (parece estar abierto/en edición) — su contenido actual ya no
// coincide con los datos originales de P01..P41 que se inspeccionaron.
const SKIP_MEXICALI = true;
if (!SKIP_MEXICALI) {
  const rows = readRows("Auto-tanques y carburados Mexicali.xlsx", "Hoja1");
  const seen = new Map(); // placa normalizada -> entry
  for (let i = 1; i <= 21; i++) {
    const r = rows[i];
    if (!r || r[0] === "") continue;
    const eco = cleanText(r[0]);
    const placas = cleanText(r[3]);
    const key = normPlaca(placas);
    const preferEco = /^[A-Za-z]/.test(eco); // preferir códigos con letra ("P01") sobre puros números
    if (seen.has(key)) {
      const existing = seen.get(key);
      if (preferEco && !/^[A-Za-z]/.test(existing.numeroEconomico)) {
        seen.set(key, { numeroEconomico: eco, sucursal: cleanText(r[1]), anio: cleanText(r[2]), placas });
      }
      continue;
    }
    seen.set(key, { numeroEconomico: eco, sucursal: cleanText(r[1]), anio: cleanText(r[2]), placas });
  }
  for (const entry of seen.values()) {
    pushEntry(candidates, {
      citySlug: "mexicali",
      sectionSlug: "auto-tanques",
      numeroEconomico: entry.numeroEconomico,
      sucursal: entry.sucursal,
      anio: entry.anio,
      placas: entry.placas,
      numeroAnterior: null,
      localidadAnterior: null,
      sheet: {},
    });
  }
}

// ===== NOGALES =====
{
  const rows = readRows("Auto-Tanques y carburados Nogales.xlsx", "Hoja1");
  for (let i = 2; i <= 6; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    pushEntry(candidates, {
      citySlug: "nogales",
      sectionSlug: "auto-tanques",
      numeroEconomico: cleanText(r[0]),
      sucursal: cleanText(r[2]),
      anio: cleanText(r[1]),
      placas: cleanText(r[3]),
      numeroAnterior: null,
      localidadAnterior: null,
      sheet: {
        serie: cleanText(r[4]),
        marcaTanque: cleanText(r[6]),
        numeroSerieTanque: cleanText(r[7]),
        anioFabricacionTanque: cleanText(r[8]),
        capacidadTanque: cleanText(r[9]),
        numeroUltimoUltrasonido: cleanText(r[10]),
        ultimoUltrasonido: excelSerialToDate(r[11]),
        fechaProximoUltrasonido: excelSerialToDate(r[12]),
      },
    });
  }
  for (let i = 9; i <= 11; i++) {
    const r = rows[i];
    if (!r || !r[0]) continue;
    pushEntry(candidates, {
      citySlug: "nogales",
      sectionSlug: "vehiculo-con-tanque-de-carburacion",
      numeroEconomico: cleanText(r[0]),
      sucursal: cleanText(r[2]),
      anio: cleanText(r[1]),
      placas: cleanText(r[3]),
      numeroAnterior: null,
      localidadAnterior: null,
      sheet: {
        serie: cleanText(r[4]),
        marcaTanque: cleanText(r[5]),
        numeroSerieTanque: cleanText(r[6]),
        anioFabricacionTanque: cleanText(r[7]),
        capacidadTanque: cleanText(r[8]),
        numeroUltimoUltrasonido: cleanText(r[9]),
        ultimoUltrasonido: excelSerialToDate(r[10]),
        fechaProximoUltrasonido: excelSerialToDate(r[11]),
      },
    });
  }
}

// ---------- Agrupar por (ciudad, sección, económico normalizado) ----------
const groups = new Map();
for (const c of candidates) {
  const key = `${c.citySlug}::${c.sectionSlug}::${normEco(c.numeroEconomico)}`;
  if (!groups.has(key)) {
    groups.set(key, { ...c, sheet: { ...c.sheet } });
  } else {
    const g = groups.get(key);
    g.sucursal ??= c.sucursal;
    g.anio ??= c.anio;
    g.placas ??= c.placas;
    g.numeroAnterior ??= c.numeroAnterior;
    g.localidadAnterior ??= c.localidadAnterior;
    for (const [k, v] of Object.entries(c.sheet)) {
      if (v !== null && v !== undefined && g.sheet[k] == null) g.sheet[k] = v;
    }
  }
}

function ecoSortKey(eco) {
  const m = String(eco).match(/^([A-Za-z]*)[\s-]*0*(\d+)?/);
  const prefix = (m?.[1] ?? "").toUpperCase();
  const num = m?.[2] ? parseInt(m[2], 10) : 0;
  return [prefix, num, String(eco)];
}

const bySection = new Map(); // citySlug::sectionSlug -> entries[]
for (const g of groups.values()) {
  const key = `${g.citySlug}::${g.sectionSlug}`;
  if (!bySection.has(key)) bySection.set(key, []);
  bySection.get(key).push(g);
}

let totalCreated = 0;
let totalEnriched = 0;
const report = [];

for (const [key, entries] of bySection.entries()) {
  const [citySlug, sectionSlug] = key.split("::");
  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) {
    report.push(`SKIP ${key}: ciudad no encontrada`);
    continue;
  }
  const root = await prisma.section.findFirst({
    where: { cityId: city.id, parentId: null, slug: "unidad-de-distribucion" },
  });
  const section = root
    ? await prisma.section.findFirst({ where: { cityId: city.id, parentId: root.id, slug: sectionSlug } })
    : null;
  if (!section) {
    report.push(`SKIP ${key}: sub-apartado no encontrado`);
    continue;
  }

  const existing = await prisma.vehicleRecord.findMany({
    where: { sectionId: section.id },
    include: { technicalSheet: true },
  });
  const existingByEco = new Map(existing.map((v) => [normEco(v.numeroEconomico), v]));

  entries.sort((a, b) => {
    const ka = ecoSortKey(a.numeroEconomico);
    const kb = ecoSortKey(b.numeroEconomico);
    if (ka[0] !== kb[0]) return ka[0] < kb[0] ? -1 : 1;
    if (ka[1] !== kb[1]) return ka[1] - kb[1];
    return ka[2].localeCompare(kb[2]);
  });

  let nextOrder =
    (await prisma.vehicleRecord.aggregate({ where: { sectionId: section.id }, _max: { order: true } }))._max
      .order ?? -1;

  for (const entry of entries) {
    const ecoKey = normEco(entry.numeroEconomico);
    const existingRecord = existingByEco.get(ecoKey);
    const hasSheetData = Object.values(entry.sheet).some((v) => v !== null && v !== undefined);

    if (existingRecord) {
      if (hasSheetData) {
        const current = existingRecord.technicalSheet;
        const updateData = {};
        for (const [k, v] of Object.entries(entry.sheet)) {
          if (v === null || v === undefined) continue;
          if (!current || current[k] == null) updateData[k] = v;
        }
        if (Object.keys(updateData).length > 0) {
          if (!DRY_RUN) {
            await prisma.vehicleTechnicalSheet.upsert({
              where: { vehicleRecordId: existingRecord.id },
              update: updateData,
              create: { vehicleRecordId: existingRecord.id, ...updateData },
            });
          }
          totalEnriched++;
          report.push(`ENRICH ${key} ${entry.numeroEconomico}: ${Object.keys(updateData).join(", ")}`);
        }
      }
      continue;
    }

    nextOrder += 1;
    report.push(
      `CREATE ${key} ${entry.numeroEconomico} | ${entry.sucursal ?? "?"} | ${entry.anio ?? "?"} | ${entry.placas ?? "?"} | sheet=${JSON.stringify(entry.sheet)}`
    );
    if (!DRY_RUN) {
      const created = await prisma.vehicleRecord.create({
        data: {
          sectionId: section.id,
          order: nextOrder,
          numeroEconomico: entry.numeroEconomico,
          sucursal: entry.sucursal ?? "Sin info.",
          anio: entry.anio ?? "Sin info.",
          placas: entry.placas ?? "Sin info.",
          numeroAnterior: entry.numeroAnterior,
          localidadAnterior: entry.localidadAnterior,
        },
      });
      if (hasSheetData) {
        await prisma.vehicleTechnicalSheet.create({
          data: { vehicleRecordId: created.id, ...entry.sheet },
        });
      }
    }
    totalCreated++;
  }
}

console.log(report.join("\n"));
console.log(`\nTotal creados: ${totalCreated}`);
console.log(`Total fichas técnicas enriquecidas: ${totalEnriched}`);

await prisma.$disconnect();
