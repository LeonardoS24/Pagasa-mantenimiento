// Llena las fechas de válvulas de las Estaciones de carburación con la hoja
// "Dat. Carbs" de "Fechas de valvulas.xls".
//
// El Excel lista por estación 8 tipos de válvula (exceso de flujo, no
// retroceso, seguridad, llenado, servicio, check lock, relevo hidrostático y
// vapor). El sistema hoy maneja el juego de Auto-Tanques, del que coinciden
// 4 — se llenan esos y los demás no se importan:
//     LLENADO      -> fechaFabricacionValvulaLlenado
//     NO RETROCESO -> fechaFabricacionValvulaNoRetroceso
//     SERVICIO     -> fechaFabricacionValvulaServicio
//     SEGURIDAD    -> fechaFabricacionValvulaAlivio ("Válvula de seguridad")
//
// La columna "AÑO" trae la fecha de FABRICACIÓN grabada en la válvula, en
// código tipo Rego: mes + letra de lote + año ("03A26" = marzo 2026). Ojo:
// en varias estaciones esa columna trae en cambio un año suelto que NO es la
// fabricación sino el próximo cambio, así que el año suelto se ignora (ver
// parseCodigoFabricacion). La columna "FECHA CAMBIO DE V" es texto libre con
// cuándo se instaló y quién lo hizo; de ahí sale la fecha de instalación.
//
// Una estación puede quedar con solo una de las dos y aun así avisar: el
// vencimiento es 7 años desde fabricación o 5 desde instalación, lo que caiga
// primero (ver lib/valve-alerts.ts). Eso cubre el caso de "si no tiene
// anterior, solo la fecha próxima".
//
// Correr con --apply para escribir; sin la bandera solo simula e imprime.
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

const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

// Qué campo del sistema le toca a cada renglón del Excel. Se revisa en orden
// y gana el primero que coincida: "NO RETROCESO" antes que nada, para que no
// se lo lleve otra regla más laxa.
const TIPOS = [
  { campo: "fechaFabricacionValvulaNoRetroceso", re: /NO\s*RETR[OO]CESO/i },
  { campo: "fechaFabricacionValvulaLlenado", re: /LLENADO/i },
  { campo: "fechaFabricacionValvulaServicio", re: /SERVICIO/i },
  // "SUGURIDAD" es como viene escrito en el Excel.
  { campo: "fechaFabricacionValvulaAlivio", re: /SU?G?URIDAD|SEGURIDAD/i },
];

const MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12,
};

function anioCompleto(yy) {
  const n = Number(yy);
  if (yy.length === 4) return n;
  // "97" -> 1997, "26" -> 2026. Corte en 50 porque los tanques más viejos
  // del Excel son de los 90 y las válvulas más nuevas de 2026.
  return n >= 50 ? 1900 + n : 2000 + n;
}

// Código de fabricación grabado en la válvula: "03A26", "4C25A", "12 23",
// "2B23". Devuelve el día 1 del mes (el día exacto no viene grabado).
//
// A propósito NO se acepta un año suelto ("2025", "2026"): esa columna no es
// uniforme en el Excel. En unas estaciones el año suelto es la fecha PRÓXIMA
// de cambio, no la de fabricación — en Pueblitos dice "2025" y la nota dice
// que se cambiaron en noviembre de 2020 (2020 + 5 años). Tomarlo como
// fabricación correría la alerta años de más, así que esas estaciones se
// resuelven con su fecha de instalación (ver parseFechaInstalacion) y el
// sistema calcula sola la próxima.
function parseCodigoFabricacion(texto) {
  const t = norm(texto).toUpperCase();
  if (!t || t === "0") return null;

  // Puede traer varias ("2B23 Y 02C23", "3D06 y 08B07"): se queda con la más
  // antigua, que es la que vence primero — mismo criterio que usa el sistema.
  const partes = t.split(/\s*(?:Y|,)\s*/).filter(Boolean);
  let masAntigua = null;
  for (const parte of partes) {
    let fecha = null;
    // mes + letra de lote + año: "03A26", "4C25A", "2B23"
    let m = parte.match(/^(\d{1,2})\s*[A-Z]\s*(\d{2})[A-Z]?$/);
    if (m) fecha = new Date(Date.UTC(anioCompleto(m[2]), Number(m[1]) - 1, 1));
    // mes + año sin letra: "12 23"
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

// Fecha de instalación (cuándo se cambió el juego), escrita a mano en la
// columna de notas del Excel con muy distintas formas. Se acepta hasta
// precisión de mes; un año suelto ("en el 2009") se descarta, porque de ahí
// no sale una fecha con la que calcular el próximo cambio sin inventar más
// de la mitad del dato.
function parseFechaInstalacion(texto) {
  const t = norm(texto);
  if (!t) return null;

  // "04 DE JUNIO DE 2026", "7 DE NOV. 2020", "16 DE MAYO 2023"
  let m = t.match(/(\d{1,2})\s*DE\s*([A-Za-zÁÉÍÓÚáéíóú]+)\.?\s*(?:DE\s*L?\s*)?(\d{4})/i);
  if (m) {
    const mes = mesDesdeNombre(m[2]);
    if (mes) return new Date(Date.UTC(Number(m[3]), mes - 1, Number(m[1])));
  }
  // "19/08/23", "28/04/2024"
  m = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return new Date(Date.UTC(anioCompleto(m[3]), Number(m[2]) - 1, Number(m[1])));
  // "09/032024": falta la diagonal, así viene capturado en Quiroga.
  m = t.match(/(\d{2})\/(\d{2})(\d{4})/);
  if (m) return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  // Solo mes y año: "MARZO DE 2024", "Septiembre de 2024". Se toma el día 1;
  // el margen de error es de días contra una vida útil de 5 años, y es
  // preferible a dejar la estación sin fecha próxima.
  m = t.match(/\b([A-Za-zÁÉÍÓÚáéíóú]{3,})\s*DE\s*L?\s*(\d{4})/i);
  if (m) {
    const mes = mesDesdeNombre(m[1]);
    if (mes) return new Date(Date.UTC(Number(m[2]), mes - 1, 1));
  }
  return null;
}

// "NOV." / "Septiembre" / "MAYO": basta con que el nombre escrito sea prefijo
// del mes (mínimo 3 letras, para no confundir marzo con mayo).
function mesDesdeNombre(nombre) {
  const limpio = nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z]/g, "");
  if (limpio.length < 3) return null;
  for (const [clave, num] of Object.entries(MESES)) {
    if (clave.startsWith(limpio) || limpio.startsWith(clave)) return num;
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
const sinEstacion = [];

for (const b of bloques) {
  const numeroEconomico = MAPEO[b.name];
  if (!numeroEconomico) {
    sinEstacion.push(b.name);
    continue;
  }

  const datos = {};
  let instalacion = null;
  for (let i = b.start + 1; i < b.end; i++) {
    const desc = norm(rows[i][0]);
    if (!/^V[AÁ]LVULA/i.test(desc)) continue;

    // La nota del cambio se lee de CUALQUIER renglón de válvula, no solo de
    // los 4 tipos que sí se importan: el juego se cambia completo de una vez,
    // y en varias estaciones esa nota quedó anotada justo en un renglón que
    // aquí no se mapea (p.ej. en Pueblitos, sobre el de exceso de flujo).
    const inst = parseFechaInstalacion(rows[i][7]);
    if (inst && (!instalacion || inst > instalacion)) instalacion = inst;

    const tipo = TIPOS.find((t) => t.re.test(desc));
    if (!tipo) continue; // exceso de flujo, check lock, relevo hidrostático, vapor

    const fabricacion = parseCodigoFabricacion(rows[i][3]);
    if (fabricacion) {
      // Si el mismo tipo aparece varias veces (varias medidas), se queda la
      // más antigua: es la que primero vence.
      if (!datos[tipo.campo] || fabricacion < datos[tipo.campo]) datos[tipo.campo] = fabricacion;
    }
  }

  if (Object.keys(datos).length === 0 && !instalacion) {
    console.log(`(sin fechas legibles) ${b.name}`);
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
    console.log(`(no está en la BD) ${b.name} -> ${numeroEconomico}`);
    continue;
  }

  const payload = { ...datos };
  if (instalacion) payload.fechaInstalacionValvulas = instalacion;

  // Misma regla que el sistema (lib/valve-alerts.ts): 7 años desde la
  // fabricación más antigua o 5 desde la instalación, lo que caiga primero.
  const fabs = Object.values(datos);
  const masAntigua = fabs.length ? new Date(Math.min(...fabs.map((d) => d.getTime()))) : null;
  const addYears = (d, y) => new Date(Date.UTC(d.getUTCFullYear() + y, d.getUTCMonth(), d.getUTCDate()));
  const candidatas = [
    masAntigua ? addYears(masAntigua, 7) : null,
    instalacion ? addYears(instalacion, 5) : null,
  ].filter(Boolean);
  const proxima = candidatas.length ? new Date(Math.min(...candidatas.map((d) => d.getTime()))) : null;

  console.log(
    `${record.section.city.name} / ${record.numeroEconomico}: ` +
      `llenado=${fmt(datos.fechaFabricacionValvulaLlenado)} ` +
      `noRetro=${fmt(datos.fechaFabricacionValvulaNoRetroceso)} ` +
      `servicio=${fmt(datos.fechaFabricacionValvulaServicio)} ` +
      `seguridad=${fmt(datos.fechaFabricacionValvulaAlivio)} ` +
      `| instalación=${fmt(instalacion)} -> PRÓXIMO CAMBIO ${fmt(proxima)}`
  );

  if (APPLY) {
    await prisma.vehicleTechnicalSheet.upsert({
      where: { vehicleRecordId: record.id },
      update: payload,
      create: { vehicleRecordId: record.id, ...payload },
    });
    aplicadas++;
  }
}

console.log(
  APPLY
    ? `\nEstaciones actualizadas: ${aplicadas}`
    : "\n(SIMULACIÓN — no se escribió nada. Correr con --apply para aplicar.)"
);
if (sinEstacion.length) {
  console.log("Bloques del Excel sin estación equivalente en el sistema:");
  sinEstacion.forEach((s) => console.log(" -", s));
}

await prisma.$disconnect();
