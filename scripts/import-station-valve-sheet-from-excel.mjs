// Llena el apartado "Válvulas" de la ficha técnica del tanque de cada
// Estación de carburación (ver lib/station-valves.ts) con la hoja
// "Dat. Carbs" de "Fechas de valvulas.xls".
//
// A diferencia del import anterior (que solo podía usar los 4 tipos que
// coincidían con el juego de un Auto-Tanque), aquí ya existen los 8 tipos
// reales de un tanque fijo, así que se carga todo: exceso de flujo, no
// retroceso, seguridad, llenado, servicio, check lock, relevo hidrostático y
// vapor.
//
// La columna "AÑO" trae el código de fabricación grabado en la válvula
// (tipo Rego: mes + letra de lote + año, "03A26" = marzo 2026). Un año suelto
// ("2025") NO se toma como fabricación: en varias estaciones esa columna
// tiene en realidad el año del próximo cambio, no el de fabricación (en
// Pueblitos dice "2025" y la nota dice que se cambiaron en noviembre de
// 2020). La columna de notas da la fecha de instalación del juego.
//
// No se guarda una fecha de instalación anterior a la fabricación de alguna
// válvula: eso es imposible y el sistema lo rechaza al capturarlo a mano
// (ver upsertStationTankTechnicalSheet). Cuando el Excel se contradice así,
// gana la fabricación (es el dato grabado en la pieza) y la instalación se
// deja vacía para capturarse bien después.
//
// Correr con --apply para escribir; sin la bandera solo simula.
import { PrismaClient } from "@prisma/client";
import XLSX from "xlsx";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const EXCEL = "C:/Users/Leonardo Silvas/Downloads/Fechas de valvulas.xls";

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
  'ESTACION HERMOSILLO " REFORMA "': "Reforma",
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
  'ESTACION NOGALES " ALAMOS "': "Alamos",
  'ESTACION NOGALES " COLINAS "': "Colinas",
};

// Se revisa en orden y gana la primera que coincida: "NO RETROCESO" y
// "CHECK LOCK" van antes de las reglas más laxas para que no se las lleve
// otra. Ojo con las faltas de ortografía del Excel: SUGURIDAD, REROCESO,
// RETRCESO, CHEK LOC, VALCULA, SERVIVIO.
const TIPOS = [
  { campo: "fechaFabricacionValvulaRelevoHidrostatico", re: /RELEVO\s*HIDROSTATICO/i },
  { campo: "fechaFabricacionValvulaCheckLock", re: /CHE[CK]+\s*L[OI]C?K?/i },
  { campo: "fechaFabricacionValvulaNoRetroceso", re: /NO\s*RET[R]?[OC]?[CR]?[OE]SO|NO\s*RETROCESO/i },
  { campo: "fechaFabricacionValvulaExcesoFlujo", re: /EXCESO\s*D[E]?\s*FLUJO/i },
  { campo: "fechaFabricacionValvulaSeguridad", re: /S[UE]G?URIDAD/i },
  { campo: "fechaFabricacionValvulaLlenado", re: /LLENADO/i },
  { campo: "fechaFabricacionValvulaServicio", re: /SERV[IV]?[CI]+O/i },
  { campo: "fechaFabricacionValvulaVapor", re: /\bVAPOR/i },
];

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

function anioCompleto(yy) {
  const n = Number(yy);
  if (String(yy).length === 4) return n;
  return n >= 50 ? 1900 + n : 2000 + n;
}

function mesDesdeNombre(nombre) {
  const limpio = nombre.toLowerCase().normalize("NFD").replace(/[^a-z]/g, "");
  if (limpio.length < 3) return null;
  for (const [clave, num] of Object.entries(MESES)) {
    if (clave.startsWith(limpio) || limpio.startsWith(clave)) return num;
  }
  return null;
}

function parseCodigoFabricacion(texto) {
  const t = norm(texto).toUpperCase();
  if (!t || t === "0") return null;
  const partes = t.split(/\s*(?:Y|,)\s*/).filter(Boolean);
  let masAntigua = null;
  for (const parte of partes) {
    let fecha = null;
    let m = parte.match(/^(\d{1,2})\s*[A-Z]\s*(\d{2})[A-Z]?$/);
    if (m) fecha = new Date(Date.UTC(anioCompleto(m[2]), Number(m[1]) - 1, 1));
    if (!fecha) {
      m = parte.match(/^(\d{1,2})\s+(\d{2})$/);
      if (m) fecha = new Date(Date.UTC(anioCompleto(m[2]), Number(m[1]) - 1, 1));
    }
    if (!fecha || Number.isNaN(fecha.getTime())) continue;
    const mes = fecha.getUTCMonth();
    if (mes < 0 || mes > 11) continue;
    if (!masAntigua || fecha < masAntigua) masAntigua = fecha;
  }
  return masAntigua;
}

function parseFechaInstalacion(texto) {
  const t = norm(texto);
  if (!t) return null;
  let m = t.match(/(\d{1,2})\s*DE\s*([A-Za-zÁÉÍÓÚáéíóú]+)\.?\s*(?:DE\s*L?\s*)?(\d{4})/i);
  if (m) {
    const mes = mesDesdeNombre(m[2]);
    if (mes) return new Date(Date.UTC(Number(m[3]), mes - 1, Number(m[1])));
  }
  m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return new Date(Date.UTC(anioCompleto(m[3]), Number(m[2]) - 1, Number(m[1])));
  m = t.match(/(\d{2})\/(\d{2})(\d{4})/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  m = t.match(/\b([A-Za-zÁÉÍÓÚáéíóú]{3,})\s*DE\s*L?\s*(\d{4})/i);
  if (m) {
    const mes = mesDesdeNombre(m[1]);
    if (mes) return new Date(Date.UTC(Number(m[2]), mes - 1, 1));
  }
  return null;
}

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

const fmt = (d) => (d ? d.toISOString().slice(0, 10) : "—");
let aplicadas = 0;
const descartadas = [];

for (const b of bloques) {
  const numeroEconomico = MAPEO[b.name];
  if (!numeroEconomico) continue;

  const datos = {};
  let instalacion = null;
  for (let i = b.start + 1; i < b.end; i++) {
    const desc = norm(rows[i][0]);
    if (!/^V[AÁ]L/i.test(desc)) continue;

    const inst = parseFechaInstalacion(rows[i][7]);
    if (inst && (!instalacion || inst > instalacion)) instalacion = inst;

    const tipo = TIPOS.find((t) => t.re.test(desc));
    if (!tipo) continue;
    const fabricacion = parseCodigoFabricacion(rows[i][3]);
    if (!fabricacion) continue;
    // El mismo tipo aparece en varias medidas: gana la más antigua, que es la
    // que vence primero.
    if (!datos[tipo.campo] || fabricacion < datos[tipo.campo]) datos[tipo.campo] = fabricacion;
  }

  // Una válvula no se instala antes de fabricarse: si el Excel se contradice,
  // se descarta la instalación y se conserva la fabricación.
  const fabs = Object.values(datos);
  if (instalacion && fabs.some((f) => instalacion < f)) {
    descartadas.push(`${numeroEconomico} (instalación ${fmt(instalacion)} anterior a la fabricación)`);
    instalacion = null;
  }

  if (fabs.length === 0 && !instalacion) continue;

  const record = await prisma.vehicleRecord.findFirst({
    where: {
      numeroEconomico,
      section: { slug: { in: ["estaciones-de-carburacion", "planta-ficha-tecnica"] } },
    },
    select: { id: true, numeroEconomico: true, section: { select: { city: { select: { name: true } } } } },
  });
  if (!record) continue;

  const payload = { ...datos, fechaInstalacionValvulas: instalacion };

  console.log(
    `${record.section.city.name} / ${record.numeroEconomico}: ${Object.keys(datos).length} válvula(s)` +
      ` | instalación=${fmt(instalacion)}`
  );

  if (APPLY) {
    await prisma.stationTankTechnicalSheet.upsert({
      where: { vehicleRecordId: record.id },
      update: payload,
      create: { vehicleRecordId: record.id, ...payload },
    });
    aplicadas++;
  }
}

console.log(
  APPLY ? `\nEstaciones actualizadas: ${aplicadas}` : "\n(SIMULACIÓN — no se escribió nada.)"
);
if (descartadas.length) {
  console.log("Fechas de instalación descartadas por incongruencia con la fabricación:");
  descartadas.forEach((d) => console.log(" -", d));
}

await prisma.$disconnect();
