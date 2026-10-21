// Da de alta "Transportadora Kino" como una ciudad más, con sus dos
// apartados de unidades (Tractocamiones y Semirremolques, ver
// lib/kino-sections.ts), sus 53 unidades con la ficha técnica armada desde
// los Word de "Expedientes de integridad", y sus PDF (facturas,
// certificados de fabricación, dictámenes NOM-068, tarjetas de
// circulación, ultrasonidos...) adjuntos a cada una.
//
// Se corre en la computadora que tiene los datos reales (ver DESPLIEGUE.md),
// después de `npx prisma migrate deploy`, con la carpeta de Kino copiada:
//
//     npx tsx scripts/crear-transportadora-kino.mts "D:\TRANSPORTADORA KINO"
//     npx tsx scripts/crear-transportadora-kino.mts "D:\TRANSPORTADORA KINO" --apply
//
// Sin --apply solo simula. Es repetible: lo que ya existe (ciudad,
// apartado, unidad, documento con el mismo nombre, ultrasonido con el mismo
// número de dictamen) se respeta y no se duplica; los datos de la ficha
// solo llenan campos vacíos, nunca pisan algo que ya se haya capturado.
//
// Fuentes, en orden de prioridad:
// 1. "Control de documentos por unidad - Transportadora Kino.xlsx", hoja
//    Unidades: la lista de unidades (17 tractocamiones + 36 semirremolques)
//    y su asignación. Hoja Registro: dictámenes NOM-068, ultrasonidos y la
//    póliza del T-39.
// 2. "RELACION DE TANQUES TKINO 2026.xlsx": capacidad en kg y operadores.
// 3. Las fichas técnicas en Word de cada unidad.
// 4. ULTRASONIDOS_LEIDOS (abajo): 14 dictámenes de ultrasonido que solo
//    vienen escaneados (sin texto) y no están en el control; se
//    transcribieron a mano de cada PDF.
//
// A16, A18 y A35 no están en la relación de tanques 2026 ni en el control,
// pero sí tienen certificado, factura y ultrasonido en la carpeta: se dan de
// alta igual (ver UNIDADES_FUERA_DE_RELACION) con una observación para
// confirmar si siguen en operación, en vez de dejarlos fuera.
//
// También arma los conjuntos (tractocamión + semirremolques) tal como vienen
// en "Expedientes de integridad/Dictamen NN - T-xx" (ver ConjuntoTransporte).
import fs from "fs/promises";
import path from "path";
import { createHash, randomUUID } from "crypto";
import XLSX from "xlsx";
import mammoth from "mammoth";
import { prisma } from "../lib/prisma";
import { PLANTILLA_KINO } from "../lib/city-template";
import { TRACTOCAMIONES_SLUG, SEMIRREMOLQUES_SLUG } from "../lib/kino-sections";
import {
  UPLOADS_DIR,
  vehicleOwnerKey,
  ultrasoundLogOwnerKey,
  insurancePolicyLogOwnerKey,
} from "../lib/documents";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const RAIZ = args.find((a) => !a.startsWith("--"));
if (!RAIZ) {
  console.error('Uso: npx tsx scripts/crear-transportadora-kino.mts "<carpeta TRANSPORTADORA KINO>" [--apply]');
  process.exit(1);
}

const CIUDAD = { name: "Transportadora Kino", slug: "transportadora-kino" };
const UNIDAD_ID = "Ismael Díaz Vanegas (Unidad de Inspección en Gas L.P.)";

// Dictámenes de ultrasonido leídos de los PDF escaneados (ver arriba). En
// A15, A17 y A31 el dictamen trae otro número Pemex, pero la serie del
// recipiente coincide con la de la unidad.
const ULTRASONIDOS_LEIDOS: Record<string, { numero: string; fecha: string; nota?: string }> = {
  A01: { numero: "EULD1-124-25", fecha: "2025-03-21" },
  A02: { numero: "EULD1-125-25", fecha: "2025-03-21" },
  A03: { numero: "EULD1-123-25", fecha: "2025-03-21" },
  A04: { numero: "EULD1-126-25", fecha: "2025-03-21" },
  A05: { numero: "EULD1-127-25", fecha: "2025-03-22" },
  A06: { numero: "EULD1-121-25", fecha: "2025-03-20" },
  A07: { numero: "EULD1-120-25", fecha: "2025-03-20" },
  A08: { numero: "EULD1-122-25", fecha: "2025-03-20" },
  A09: { numero: "EULD1-132-25", fecha: "2025-03-23" },
  A10: { numero: "EULD1-130-25", fecha: "2025-03-22" },
  A15: { numero: "EULD1-128-25", fecha: "2025-03-22", nota: "El dictamen lo identifica como PG-2240-B; la serie 00SEMAT1181 corresponde a A15." },
  A17: { numero: "EULD1-133-25", fecha: "2025-03-24", nota: "El dictamen lo identifica como PG-3276-A; la serie 3T92TE4DXY7049136 corresponde a A17." },
  A19: { numero: "EULD1-135-25", fecha: "2025-03-24" },
  A31: { numero: "EULD1-136-25", fecha: "2025-03-24", nota: "El dictamen lo identifica como PG-2395-B; la serie 922TTAT2516 corresponde a A31." },
};

// Semirremolques que no vienen en la relación 2026. Datos tomados del
// dictamen de ultrasonido escaneado de cada uno (A16 y A35); de A18 solo se
// sabe su número Pemex por el nombre de sus archivos.
const NOTA_FUERA_DE_RELACION =
  "No aparece en la relación de tanques 2026 ni en el control de documentos; se dio de alta con los documentos de la carpeta. Confirmar si sigue en operación.";
const UNIDADES_FUERA_DE_RELACION = [
  { eco: "A16", pemex: "PG-2182-B", anio: "2000", marca: "SEMASA", serie: "00SEMAT1182", capacidad: "40000" },
  { eco: "A18", pemex: "PG-2182", anio: "", marca: "", serie: "", capacidad: "" },
  { eco: "A35", pemex: "PG-2571-A", anio: "1977", marca: "TATSA", serie: "SBT-0307", capacidad: "45420" },
];

// Ultrasonidos de la carpeta que vienen como "Sin economico en el Excel":
// el dictamen dice a qué número Pemex corresponde. PG-2182-A NO se asigna:
// A18 dice solo "PG-2182" y no se pudo confirmar su serie (su certificado y
// factura no se pueden leer), así que se deja pendiente.
const ULTRASONIDOS_SIN_ECONOMICO: Record<string, { eco: string; numero: string; fecha: string }> = {
  "PG-2182-B": { eco: "A16", numero: "EULD1-131-25", fecha: "2025-03-23" },
  "PG-2571-A": { eco: "A35", numero: "EULD1-200-22", fecha: "2022-09-04" },
};

const t = (v: unknown) => String(v ?? "").replace(/\s+/g, " ").trim();
const ruta = (...partes: string[]) => path.join(RAIZ!, ...partes);
const addYears = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), d.getUTCDate()));

// "11/02/2026" -> Date UTC
function fechaDMY(texto: string): Date | null {
  const m = t(texto).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]))) : null;
}

// Un valor de la ficha Word que no es dato ("No indica la factura",
// "Pendiente: ...") no se guarda.
function valorUtil(v: string | undefined): string | null {
  const s = t(v);
  if (!s || /^no indica|^pendiente|^no consta|^—$|^-$/i.test(s)) return null;
  return s;
}

// La ficha técnica valida largos máximos (ver actions/vehicle-actions.ts):
// si el texto de la ficha Word trae una aclaración larga, se le quita lo de
// después de "," / ";" / "(" hasta que quepa.
function cabe(v: string | null, max: number): string | null {
  if (!v) return null;
  let s = v;
  for (const corte of [/\s*\(.*$/, /\s*;.*$/, /\s*,\s*indicad.*$/i, /\s*,.*$/]) {
    if (s.length <= max) break;
    s = s.replace(corte, "");
  }
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

// Filas etiqueta/valor de las tablas de un .docx.
async function filasDocx(archivo: string): Promise<[string, string][]> {
  const { value } = await mammoth.convertToHtml({ path: archivo });
  return [...value.matchAll(/<tr>(.*?)<\/tr>/g)]
    .map((tr) => [...tr[1].matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/g)].map((c) => t(c[1].replace(/<[^>]+>/g, " "))))
    .filter((celdas) => celdas.length >= 2)
    .map((celdas) => [celdas[0], celdas[1]] as [string, string]);
}

// Valor de la n-ésima aparición de una etiqueta (la ficha del tractocamión
// repite "Fabricante", "Modelo", "Tipo"... en cada bloque).
function enesimo(filas: [string, string][], etiqueta: string, n = 1): string | null {
  const coincidencias = filas.filter(([e]) => e.toLowerCase() === etiqueta.toLowerCase());
  return valorUtil(coincidencias[n - 1]?.[1]);
}
const ultimo = (filas: [string, string][], etiqueta: string) => {
  const c = filas.filter(([e]) => e.toLowerCase() === etiqueta.toLowerCase());
  return valorUtil(c[c.length - 1]?.[1]);
};

async function listar(dir: string): Promise<string[]> {
  const salida: string[] = [];
  async function recorrer(d: string) {
    let entradas;
    try {
      entradas = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entradas) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await recorrer(p);
      else salida.push(p);
    }
  }
  await recorrer(dir);
  return salida;
}

// ---------------------------------------------------------------- datos

type Unidad = {
  tipo: "TRACTO" | "SEMI";
  eco: string;
  pemex: string;
  anio: string;
  marca: string;
  serie: string;
  placas: string;
  capacidad: string;
  idCre: string;
  asignacion: string;
};

const control = XLSX.readFile(ruta("Control de documentos por unidad - Transportadora Kino.xlsx"));
const unidades: Unidad[] = XLSX.utils
  .sheet_to_json<string[]>(control.Sheets["Unidades"], { header: 1, defval: "", raw: false })
  .slice(1)
  .filter((r) => r[0] === "Tractocamión" || r[0] === "Semirremolque")
  .map((r) => ({
    tipo: r[0] === "Tractocamión" ? "TRACTO" : "SEMI",
    eco: t(r[1]),
    pemex: t(r[2]),
    anio: t(r[3]),
    marca: t(r[4]),
    serie: t(r[5]),
    placas: t(r[6]),
    capacidad: t(r[7]).replace(/,/g, ""),
    idCre: t(r[8]),
    asignacion: t(r[9]).replace(/^(Semirremolques|Tractocamión):\s*/, ""),
  }));

for (const extra of UNIDADES_FUERA_DE_RELACION) {
  if (!unidades.some((u) => u.eco === extra.eco)) {
    unidades.push({ tipo: "SEMI", placas: "", idCre: "", asignacion: "", ...extra });
  }
}

const registro = XLSX.utils
  .sheet_to_json<string[]>(control.Sheets["Registro"], { header: 1, defval: "", raw: false })
  .slice(3)
  .map((r) => ({ eco: t(r[1]), documento: t(r[3]), estado: t(r[5]), fecha: t(r[6]), vigencia: t(r[7]), folio: t(r[8]), obs: t(r[9]) }));

// Capacidad en kg y operadores, de la relación de tanques (Hoja1 trae los
// tractocamiones intercalados; los nombres del operador vienen partidos en
// las filas de sus semirremolques).
const relacion = XLSX.readFile(ruta("RELACION DE TANQUES TKINO 2026.xlsx"));
const kgPorEco = new Map<string, { kg100: string; kg85: string }>();
const operadorPorTracto = new Map<string, string>();
for (const hoja of relacion.SheetNames) {
  const filas = XLSX.utils.sheet_to_json<string[]>(relacion.Sheets[hoja], { header: 1, defval: "", raw: false });
  let tractoActual: string | null = null;
  let nombres: string[] = [];
  const cerrar = () => {
    if (tractoActual && nombres.length && hoja === relacion.SheetNames[0]) operadorPorTracto.set(tractoActual, nombres.join(" "));
  };
  for (const r of filas) {
    const eco = t(r[2]);
    if (/^T-\d+$/.test(eco)) {
      cerrar();
      tractoActual = eco;
      nombres = [];
    } else if (/^A\d+$/.test(eco)) {
      kgPorEco.set(eco, { kg100: t(r[8]), kg85: t(r[9]) });
      const nombre = t(r[0]);
      // "TIJUANA" es una nota de ubicación, no un nombre.
      if (nombre && nombre !== "TIJUANA") nombres.push(nombre);
    }
  }
  cerrar();
}

// Fichas técnicas en Word: la primera que aparezca por unidad.
const todos = await listar(RAIZ);
const fichaPorEco = new Map<string, string>();
for (const archivo of todos.filter((a) => a.toLowerCase().endsWith(".docx") && a.includes("Expedientes de integridad"))) {
  const nombre = path.basename(archivo);
  const m = nombre.match(/Ficha técnica - ([AT]-?\d+)\.docx$/i) ?? nombre.match(/_(T)(\d+)\.docx$/);
  if (!m) continue;
  const eco = m.length === 3 ? `T-${m[2]}` : m[1];
  if (!fichaPorEco.has(eco)) fichaPorEco.set(eco, archivo);
}

// PDF de cada unidad. Para un tractocamión se buscan "T-15", "TRACTO-43",
// "TC 15" en el nombre; un dictamen de dos tractocamiones
// ("T-15-T-16-DICTAMEN...") se adjunta a ambos.
function documentosDe(u: Unidad): string[] {
  const pdfs = todos.filter((a) => a.toLowerCase().endsWith(".pdf"));
  if (u.tipo === "SEMI") {
    return pdfs.filter((a) => {
      const nombre = path.basename(a);
      const carpeta = path.basename(path.dirname(a));
      if (carpeta === "Escaneado sin editar") return false;
      if (nombre.startsWith(`${u.eco} - `)) return true; // certificados, NOM-068, ultrasonido
      const sinEco = nombre.match(/^Sin economico en el Excel - (PG-[\d-]+?[AB]?) - /);
      if (sinEco && ULTRASONIDOS_SIN_ECONOMICO[sinEco[1]]?.eco === u.eco) return true;
      if (nombre.startsWith(`${u.eco} “`)) return true; // facturas por semirremolque
      if (carpeta.startsWith(`${u.eco} “`) || carpeta === u.eco) return true; // expediente
      return false;
    });
  }
  const numero = u.eco.replace("T-", "");
  const re = /(?:^|[^A-Z])(?:T|TRACTO|TC)[-\s]?(\d{2})(?!\d)/gi;
  return pdfs.filter((a) => {
    const nombre = path.basename(a);
    const carpeta = path.basename(path.dirname(a));
    if (carpeta === u.eco && a.includes("Expedientes de integridad")) return true;
    if (!/Facturas Tractocamion|Documentos Variados/.test(a)) return false;
    return [...nombre.matchAll(re)].some((m) => m[1] === numero);
  });
}

const esUltrasonido = (archivo: string) => /Ultrasonido NOM-013/i.test(path.basename(archivo));
const esSeguro = (archivo: string) => /^SEGURO-/i.test(path.basename(archivo));

// ------------------------------------------------------------- ficha

async function fichaTractocamion(u: Unidad): Promise<Record<string, unknown>> {
  const datos: Record<string, unknown> = {
    serie: u.serie || null,
    unidadAsignada: u.asignacion || null,
    chofer: operadorPorTracto.get(u.eco) ?? null,
    combustible: "DIESEL",
  };
  const archivo = fichaPorEco.get(u.eco);
  if (!archivo) return datos;
  const f = await filasDocx(archivo);
  Object.assign(datos, {
    marca: cabe(enesimo(f, "Marca"), 100),
    linea: cabe(enesimo(f, "Modelo", 1), 100),
    serie: cabe(enesimo(f, "No. identificador vehicular (VIN)"), 100) ?? datos.serie,
    claveVehicular: cabe(enesimo(f, "Clave vehicular"), 150),
    facturaNumero: cabe(enesimo(f, "Factura"), 150),
    facturaFecha: cabe(enesimo(f, "Fecha de factura"), 150),
    motorMarca: cabe(enesimo(f, "Fabricante", 1), 150),
    motorModelo: cabe(enesimo(f, "Modelo", 2), 150),
    potencia: cabe(enesimo(f, "Potencia nominal indicada"), 150),
    motorTorque: cabe(enesimo(f, "Torque indicado"), 150),
    numeroMotor: cabe(enesimo(f, "Número de motor"), 150),
    transmisionMarca: cabe(enesimo(f, "Fabricante", 2), 150),
    transmisionModelo: cabe(enesimo(f, "Modelo", 3), 150),
    transmisionVelocidades: cabe(enesimo(f, "Velocidades"), 150),
    numeroTransmision: cabe(enesimo(f, "Número de transmisión"), 150),
    ejeDelantero: cabe(ultimo(f, "Eje delantero"), 150),
    ejesTraseros: cabe(ultimo(f, "Ejes traseros"), 150),
    suspension: cabe(ultimo(f, "Suspensión"), 150),
    cabina: cabe(enesimo(f, "Cabina"), 150),
    dormitorio: cabe(ultimo(f, "Dormitorio"), 150),
    quintaRueda: cabe(enesimo(f, "Serie / identificación indicada"), 150),
    pesoBrutoVacio: cabe(enesimo(f, "Peso bruto de la unidad vacía (kg)"), 50),
    pesoBrutoMaximo: cabe(enesimo(f, "Peso bruto con carga máxima (kg)"), 50),
  });
  return datos;
}

async function fichaSemirremolque(u: Unidad): Promise<Record<string, unknown>> {
  const kg = kgPorEco.get(u.eco);
  const datos: Record<string, unknown> = {
    marca: u.marca || null,
    serie: u.serie || null,
    numeroSerieTanque: u.serie || null,
    marcaTanque: u.marca || null,
    anioFabricacionTanque: u.anio || null,
    capacidadTanque: u.capacidad || null,
    numeroPemex: u.pemex || null,
    idCre: u.idCre || null,
    unidadAsignada: u.asignacion || null,
    placaCapacidadKg: kg?.kg100 || null,
    placaCapacidadPorcentaje: kg?.kg85 ? `85 %: ${kg.kg85} kg` : null,
    placaContenido: "Gas L.P.",
  };
  const archivo = fichaPorEco.get(u.eco);
  if (!archivo) return datos;
  const f = await filasDocx(archivo);
  const material = cabe(enesimo(f, "Material de cuerpo y cabezas"), 100);
  const pruebas = [enesimo(f, "Fecha de pruebas")].filter(Boolean).join("");
  Object.assign(datos, {
    placaPresionDiseno: cabe(enesimo(f, "Presión de diseño"), 50),
    placaPresionMaximaTrabajo: cabe(enesimo(f, "Presión de trabajo máxima permitida"), 50),
    placaEspesorMinPlacaCuerpo: cabe(enesimo(f, "Espesor de la sección cilíndrica"), 50),
    placaEspesorMinPlacaCabeza: cabe(enesimo(f, "Espesor de los casquetes"), 50),
    placaRelevo: cabe(enesimo(f, "Presión de calibración de la(s) válvula(s) de seguridad"), 50),
    placaNormaFabricacion: cabe(enesimo(f, "Norma de fabricación"), 100),
    marcaTanque: cabe(enesimo(f, "Fabricante"), 100) ?? datos.marcaTanque,
    anioFabricacionTanque: cabe(enesimo(f, "Año de construcción"), 20) ?? datos.anioFabricacionTanque,
    placaMaterialCuerpo: material,
    placaMaterialCabeza: material,
    placaCabezales: cabe(enesimo(f, "Tipo de cabezal"), 100),
    placaTemperaturaDiseno: cabe(enesimo(f, "Temperatura máxima"), 50),
    placaLongitudTotal: cabe(enesimo(f, "Longitud total"), 50),
    placaDiametroExterior: cabe(enesimo(f, "Diámetro"), 50),
    placaFechaPruebaOriginal: cabe(pruebas || null, 50),
    fabricadoPara: cabe(enesimo(f, "Fabricado para"), 150),
    ordenTrabajo: cabe(enesimo(f, "Orden de trabajo (O.T.)"), 150),
    factorSeguridad: cabe(enesimo(f, "Factor de seguridad"), 150),
    sobreespesorCorrosion: cabe(enesimo(f, "Sobreespesor por corrosión"), 150),
    soldadura: cabe(enesimo(f, "Soldadura de cuerpo y cabezas"), 150),
    relevadoEsfuerzos: cabe(enesimo(f, "Relevado de esfuerzos"), 150),
    pruebasFabricacion: cabe(enesimo(f, "Pruebas realizadas"), 150),
    presionPruebaHidrostatica: cabe(enesimo(f, "Presión de prueba hidrostática"), 150),
    resultadoPruebas: cabe(enesimo(f, "Resultado"), 150),
  });
  return datos;
}

// --------------------------------------------------------- escritura

const resumen = { unidadesNuevas: 0, unidadesExistentes: 0, camposFicha: 0, documentos: 0, documentosRepetidos: 0, ultrasonidos: 0, polizas: 0 };

async function copiarArchivo(ownerKey: string, origen: string): Promise<{ storedName: string; size: number }> {
  const datos = await fs.readFile(origen);
  const storedName = `${randomUUID()}.pdf`;
  if (APPLY) {
    const dir = path.join(UPLOADS_DIR, ownerKey);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, storedName), datos);
  }
  return { storedName, size: datos.length };
}

async function sha1(archivo: string) {
  return createHash("sha1").update(await fs.readFile(archivo)).digest("hex");
}

// Ciudad + apartados: solo "Unidad de distribución" (Tractocamiones y
// Semirremolques) y "Bitácoras de unidades" (ver PLANTILLA_KINO).
let ciudad = await prisma.city.findUnique({ where: { slug: CIUDAD.slug } });
if (!ciudad) {
  console.log(`+ Ciudad "${CIUDAD.name}"`);
  if (APPLY) {
    const max = await prisma.city.aggregate({ _max: { order: true } });
    ciudad = await prisma.city.create({ data: { ...CIUDAD, order: (max._max.order ?? 0) + 1 } });
  }
}

const seccionPorSlug = new Map<string, string>();
if (ciudad) {
  for (const [indice, apartado] of PLANTILLA_KINO.entries()) {
    let seccion = await prisma.section.findFirst({ where: { cityId: ciudad.id, parentId: null, slug: apartado.slug } });
    if (!seccion && APPLY) {
      seccion = await prisma.section.create({ data: { cityId: ciudad.id, parentId: null, name: apartado.name, slug: apartado.slug, order: indice } });
    }
    if (apartado.slug === "unidad-de-distribucion" && seccion) {
      for (const [i, hijo] of [
        { name: "Tractocamiones", slug: TRACTOCAMIONES_SLUG },
        { name: "Semirremolques", slug: SEMIRREMOLQUES_SLUG },
      ].entries()) {
        let sub = await prisma.section.findFirst({ where: { cityId: ciudad.id, parentId: seccion.id, slug: hijo.slug } });
        if (!sub && APPLY) sub = await prisma.section.create({ data: { cityId: ciudad.id, parentId: seccion.id, ...hijo, order: i } });
        if (sub) seccionPorSlug.set(hijo.slug, sub.id);
      }
    }
  }
}

const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });

for (const [orden, u] of unidades.entries()) {
  const slug = u.tipo === "TRACTO" ? TRACTOCAMIONES_SLUG : SEMIRREMOLQUES_SLUG;
  const sectionId = seccionPorSlug.get(slug);
  const ficha = u.tipo === "TRACTO" ? await fichaTractocamion(u) : await fichaSemirremolque(u);
  for (const k of Object.keys(ficha)) if (ficha[k] === null || ficha[k] === undefined || ficha[k] === "") delete ficha[k];

  // NOM-068 (semirremolques): no hay alerta propia para este dictamen, así
  // que su folio y vigencia quedan en Observaciones para tenerlos a la vista.
  const nom068 = registro.find((r) => r.eco === u.eco && r.documento.startsWith("Dictamen NOM-068") && r.estado === "Tenemos");
  const observaciones = UNIDADES_FUERA_DE_RELACION.some((x) => x.eco === u.eco)
    ? NOTA_FUERA_DE_RELACION
    : nom068
      ? `Dictamen NOM-068-SCT-2-2014: ${nom068.folio.replace(/,.*$/, "")}, del ${nom068.fecha}, vigente hasta ${nom068.vigencia}.`
      : null;

  let unidad = sectionId ? await prisma.vehicleRecord.findFirst({ where: { sectionId, numeroEconomico: u.eco }, include: { technicalSheet: true } }) : null;
  const marcaGeneral = u.tipo === "TRACTO" ? (u.marca === "KW" || !u.marca ? "Kenworth" : u.marca) : u.marca;

  if (!unidad) {
    resumen.unidadesNuevas++;
    console.log(`+ ${u.eco} (${u.tipo === "TRACTO" ? "tractocamión" : "semirremolque"}): ${Object.keys(ficha).length} campos de ficha`);
    resumen.camposFicha += Object.keys(ficha).length;
    if (APPLY && sectionId) {
      unidad = await prisma.vehicleRecord.create({
        data: {
          sectionId,
          order: orden,
          numeroEconomico: u.eco,
          sucursal: marcaGeneral,
          anio: u.anio || null,
          placas: u.placas || null,
          observaciones,
          createdById: admin?.id ?? null,
          technicalSheet: { create: ficha },
        },
        include: { technicalSheet: true },
      });
    }
  } else {
    resumen.unidadesExistentes++;
    const actual = (unidad.technicalSheet ?? {}) as Record<string, unknown>;
    const faltantes = Object.fromEntries(Object.entries(ficha).filter(([k]) => actual[k] === null || actual[k] === undefined || actual[k] === ""));
    if (Object.keys(faltantes).length) {
      console.log(`~ ${u.eco}: completa ${Object.keys(faltantes).length} campos de ficha`);
      resumen.camposFicha += Object.keys(faltantes).length;
      if (APPLY) {
        await prisma.vehicleTechnicalSheet.upsert({
          where: { vehicleRecordId: unidad.id },
          update: faltantes,
          create: { vehicleRecordId: unidad.id, ...faltantes },
        });
      }
    }
  }

  // ---- documentos
  const archivos = documentosDe(u);
  const vistos = new Set<string>();
  const existentes = unidad
    ? await prisma.document.findMany({
        where: {
          OR: [
            { vehicleRecordId: unidad.id },
            { ultrasoundLog: { vehicleRecordId: unidad.id } },
            { insurancePolicyLog: { vehicleRecordId: unidad.id } },
          ],
        },
        select: { fileName: true },
      })
    : [];
  const nombresExistentes = new Set(existentes.map((d) => d.fileName));

  for (const archivo of archivos) {
    const hash = await sha1(archivo);
    const nombre = path.basename(archivo);
    // El mismo PDF en dos carpetas (p. ej. la factura del expediente y la
    // de "Facturas") se sube una sola vez.
    // El hash se anota aunque el archivo se salte por nombre: así su copia
    // con otro nombre en otra carpeta también se reconoce como repetida al
    // volver a correr el script.
    const repetido = vistos.has(hash) || nombresExistentes.has(nombre);
    vistos.add(hash);
    if (repetido) {
      resumen.documentosRepetidos++;
      continue;
    }

    if (esUltrasonido(archivo) && u.tipo === "SEMI") {
      const delControl = registro.find((r) => r.eco === u.eco && r.documento.startsWith("Ultrasonido") && r.estado === "Tenemos");
      const leido =
        ULTRASONIDOS_LEIDOS[u.eco] ??
        Object.values(ULTRASONIDOS_SIN_ECONOMICO).find((x) => x.eco === u.eco);
      const numero = delControl?.folio.match(/EULD\d-\d+-\d+/)?.[0] ?? leido?.numero;
      const fecha = delControl ? fechaDMY(delControl.fecha) : leido ? new Date(`${leido.fecha}T00:00:00Z`) : null;
      if (numero && fecha) {
        const proxima = addYears(fecha, 5);
        console.log(`    ultrasonido ${numero} (${fecha.toISOString().slice(0, 10)} → ${proxima.toISOString().slice(0, 10)}) + ${nombre}`);
        resumen.ultrasonidos++;
        resumen.documentos++;
        if (APPLY && unidad) {
          const yaExiste = await prisma.ultrasoundLog.findFirst({ where: { vehicleRecordId: unidad.id, numeroUltrasonido: numero } });
          const log =
            yaExiste ??
            (await prisma.ultrasoundLog.create({
              data: {
                vehicleRecordId: unidad.id,
                compania: UNIDAD_ID,
                numeroUltrasonido: numero,
                fechaRealizacion: fecha,
                fechaProximoUltrasonido: proxima,
                createdById: admin?.id ?? null,
              },
            }));
          const { storedName, size } = await copiarArchivo(ultrasoundLogOwnerKey(log.id), archivo);
          await prisma.document.create({
            data: { sectionId: unidad.sectionId, ultrasoundLogId: log.id, fileName: nombre, storedName, mimeType: "application/pdf", size, uploadedById: admin?.id ?? null },
          });
          // Mismo efecto que registrar el ultrasonido desde la página (ver
          // actions/ultrasound-actions.ts): la ficha refleja el más reciente.
          const fichaActual = await prisma.vehicleTechnicalSheet.findUnique({ where: { vehicleRecordId: unidad.id } });
          if (!fichaActual?.ultimoUltrasonido || fichaActual.ultimoUltrasonido < fecha) {
            await prisma.vehicleTechnicalSheet.upsert({
              where: { vehicleRecordId: unidad.id },
              update: { numeroUltimoUltrasonido: numero, ultimoUltrasonido: fecha, fechaProximoUltrasonido: proxima },
              create: { vehicleRecordId: unidad.id, numeroUltimoUltrasonido: numero, ultimoUltrasonido: fecha, fechaProximoUltrasonido: proxima },
            });
          }
        }
        continue;
      }
    }

    if (esSeguro(archivo)) {
      const poliza = registro.find((r) => r.eco === u.eco && r.documento === "Póliza de seguro" && r.fecha);
      const realizacion = poliza ? fechaDMY(poliza.fecha) : null;
      const vencimiento = poliza ? fechaDMY(poliza.vigencia) : null;
      if (poliza && realizacion && vencimiento) {
        console.log(`    póliza ${poliza.folio} (vence ${poliza.vigencia}) + ${nombre}`);
        resumen.polizas++;
        resumen.documentos++;
        if (APPLY && unidad) {
          const log = await prisma.insurancePolicyLog.create({
            data: {
              vehicleRecordId: unidad.id,
              fechaRealizacion: realizacion,
              fechaVencimiento: vencimiento,
              aseguradora: poliza.folio.match(/P[óo]liza\s+(\S+)/i)?.[1] ?? null,
              numeroPoliza: poliza.folio.match(/(\d{6,})/)?.[1] ?? null,
              observaciones: poliza.obs || null,
              createdById: admin?.id ?? null,
            },
          });
          const { storedName, size } = await copiarArchivo(insurancePolicyLogOwnerKey(log.id), archivo);
          await prisma.document.create({
            data: { sectionId: unidad.sectionId, insurancePolicyLogId: log.id, fileName: nombre, storedName, mimeType: "application/pdf", size, uploadedById: admin?.id ?? null },
          });
        }
        continue;
      }
    }

    console.log(`    documento ${nombre}`);
    resumen.documentos++;
    if (APPLY && unidad) {
      const { storedName, size } = await copiarArchivo(vehicleOwnerKey(unidad.id), archivo);
      await prisma.document.create({
        data: { sectionId: unidad.sectionId, vehicleRecordId: unidad.id, fileName: nombre, storedName, mimeType: "application/pdf", size, uploadedById: admin?.id ?? null },
      });
    }
  }
}

// ------------------------------------------------------------ conjuntos
// Una carpeta "Dictamen NN - T-xx" por conjunto, con una subcarpeta para el
// tractocamión ("T-xx") y una por semirremolque ("A13 “PG-0080” (A)").
// "Dictamen 1" (sin tractocamión en el nombre) es el expediente piloto.
const conjuntosLeidos: { nombre: string; tracto: string | null; semis: string[] }[] = [];
try {
  const base = ruta("Expedientes de integridad");
  for (const carpeta of await fs.readdir(base, { withFileTypes: true })) {
    if (!carpeta.isDirectory()) continue;
    const m = carpeta.name.match(/^Dictamen\s+(\d+)/i);
    if (!m) continue;
    const subcarpetas = (await fs.readdir(path.join(base, carpeta.name), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
    const tracto = subcarpetas.find((n) => /^T-\d+$/.test(n)) ?? null;
    const semis = subcarpetas
      .map((n) => n.match(/^(A\d{2})\b/)?.[1])
      .filter((x): x is string => !!x)
      .sort();
    const nombre = m[1].length === 1 ? `Dictamen ${m[1]} (piloto)` : `Dictamen ${m[1]}`;
    conjuntosLeidos.push({ nombre, tracto, semis });
  }
} catch {
  console.log("(No se encontró la carpeta Expedientes de integridad: no se arman conjuntos)");
}
conjuntosLeidos.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { numeric: true }));

let conjuntosNuevos = 0;
if (ciudad) {
  for (const [i, c] of conjuntosLeidos.entries()) {
    const existe = await prisma.conjuntoTransporte.findFirst({ where: { cityId: ciudad.id, nombre: c.nombre } });
    if (existe) continue;
    const buscar = (eco: string, slug: string) =>
      prisma.vehicleRecord.findFirst({ where: { numeroEconomico: eco, section: { cityId: ciudad!.id, slug } }, include: { conjuntoSemirremolque: true } });
    const tracto = c.tracto ? await buscar(c.tracto, TRACTOCAMIONES_SLUG) : null;
    const semis = [];
    for (const eco of c.semis) {
      const semi = await buscar(eco, SEMIRREMOLQUES_SLUG);
      // Un semirremolque solo puede estar en un conjunto: si ya está en
      // otro (capturado a mano), se respeta.
      if (semi && !semi.conjuntoSemirremolque) semis.push(semi);
    }
    console.log(`+ conjunto ${c.nombre}: ${[c.tracto, ...c.semis].filter(Boolean).join(" + ")}`);
    conjuntosNuevos++;
    if (APPLY && (tracto || semis.length)) {
      await prisma.conjuntoTransporte.create({
        data: {
          cityId: ciudad.id,
          nombre: c.nombre,
          orden: i + 1,
          tractocamionId: tracto?.id ?? null,
          semirremolques: { create: semis.map((s, orden) => ({ vehicleRecordId: s.id, orden })) },
        },
      });
    }
  }
} else {
  conjuntosNuevos = conjuntosLeidos.length;
  for (const c of conjuntosLeidos) console.log(`+ conjunto ${c.nombre}: ${[c.tracto, ...c.semis].filter(Boolean).join(" + ")}`);
}

const ecosConUnidad = new Set(unidades.map((u) => u.eco));
const sinUnidad = todos
  .filter((a) => a.toLowerCase().endsWith(".pdf"))
  .filter((a) => {
    const m = path.basename(a).match(/^(A\d{2})\s/);
    return m && !ecosConUnidad.has(m[1]);
  })
  .map((a) => path.basename(a));

console.log("\n=== Resumen");
console.log(`  Unidades nuevas: ${resumen.unidadesNuevas} · ya existentes: ${resumen.unidadesExistentes}`);
console.log(`  Campos de ficha técnica: ${resumen.camposFicha}`);
console.log(`  Documentos: ${resumen.documentos} (de ellos ${resumen.ultrasonidos} ultrasonidos y ${resumen.polizas} póliza) · repetidos omitidos: ${resumen.documentosRepetidos}`);
console.log(`  Fichas Word encontradas: ${fichaPorEco.size} de ${unidades.length} unidades`);
console.log(`  Conjuntos nuevos (dictámenes): ${conjuntosNuevos}`);
console.log(`  PDF de unidades que no existen (no se subieron): ${sinUnidad.length}`);
for (const s of sinUnidad) console.log(`    - ${s}`);
const pendientes = todos.filter((a) => /^Sin economico en el Excel - (PG-[\d-]+?[AB]?) - /.test(path.basename(a)) && !ULTRASONIDOS_SIN_ECONOMICO[path.basename(a).match(/ - (PG-[\d-]+?[AB]?) - /)![1]]);
console.log(`  Ultrasonidos sin unidad confirmada (pendientes): ${pendientes.length}`);
for (const a of pendientes) console.log(`    - ${path.basename(a)}`);
console.log(APPLY ? "\nCambios guardados." : "\nSimulación: no se guardó nada. Corre con --apply para guardar.");

await prisma.$disconnect();
