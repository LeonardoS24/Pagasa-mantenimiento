import { prisma } from "./prisma";
import { XLSX, escribirLibro, hojaConFormato } from "./excel-formato";
import { CAMPOS_POR_TIPO, type TipoLote } from "./lote-documentos";
import { aplicaEnLote, camposObligatoriosEnLote, etiquetaDeCampo, TIPOS_EN_LOTE } from "./registro-lote";
import { etiquetasDeUnidades, normalizar } from "./almacen";
import {
  COL_UNIDAD,
  HOJA_DE_TIPO,
  MAX_FILAS_EXCEL,
  encabezadosDeTipo,
  leerHojaRegistros,
  tipoDeHoja,
  type FilaRegistro,
  type ProblemaRegistro,
  type UnidadResuelta,
} from "./registros-excel";

// Plantilla y lectura del Excel de registros nuevos de bitácora (lógica pura
// en lib/registros-excel.ts). La unidad se escribe tal como sale en la
// plantilla: «KG-158 · Auto-Tanques · Mexicali».

type UnidadDeCiudad = UnidadResuelta & { etiqueta: string };

async function unidadesDe(cityIds: string[]): Promise<UnidadDeCiudad[]> {
  const registros = await prisma.vehicleRecord.findMany({
    where: { activo: true, section: { cityId: { in: cityIds } } },
    select: {
      id: true,
      numeroEconomico: true,
      section: { select: { slug: true, name: true, order: true, city: { select: { name: true, order: true } } } },
    },
  });
  registros.sort(
    (a, b) =>
      a.section.city.order - b.section.city.order ||
      a.section.order - b.section.order ||
      a.numeroEconomico.localeCompare(b.numeroEconomico, "es", { numeric: true })
  );
  const etiquetas = etiquetasDeUnidades(
    registros.map((r) => ({ id: r.id, nombre: r.numeroEconomico, apartado: r.section.name, ciudad: r.section.city.name }))
  );
  return registros.map((r, i) => ({ id: r.id, nombre: r.numeroEconomico, slug: r.section.slug, etiqueta: etiquetas[i].etiqueta }));
}

const INSTRUCCIONES = [
  ["Cómo usar esta plantilla"],
  [""],
  ["1. Cada hoja es un tipo de registro de bitácora (Ultrasonido, Extintor, Mantenimiento…). Cada renglón es UN registro nuevo."],
  ["2. Las unidades de la ciudad ya vienen puestas. Llena solo los renglones de las unidades a las que les hiciste ese registro; los renglones sin datos se ignoran."],
  ["3. Si necesitas dos registros de la misma unidad, copia el renglón. No cambies el texto de la columna «Unidad»."],
  ["4. Las fechas van como dd/mm/aaaa (por ejemplo 05/03/2026). Abajo se listan las columnas obligatorias de cada hoja."],
  ["5. Donde hay opciones, escribe una de las que aparecen abajo."],
  ["6. Súbela en «Registros desde Excel»: el sistema te muestra cada registro, te pide tu contraseña y no guarda nada hasta que lo confirmes."],
  ["7. Esto CREA registros nuevos (lo anterior queda como historial). Si subes el mismo archivo dos veces, se duplican: cuando termines, descarga una plantilla nueva."],
  ["8. En ultrasonido, inspecciones y pruebas, cada unidad trae el número de su propio dictamen: es obligatorio y no se puede repetir entre renglones de la misma hoja."],
  [""],
];

export async function armarPlantillaRegistros(cityIds: string[]): Promise<Buffer> {
  const unidades = await unidadesDe(cityIds);
  const libro = XLSX.utils.book_new();

  const instrucciones = [...INSTRUCCIONES];
  for (const tipo of TIPOS_EN_LOTE) {
    const obligatorias = camposObligatoriosEnLote(tipo).map((c) => etiquetaDeCampo(tipo, c));
    instrucciones.push([`${HOJA_DE_TIPO[tipo]} → obligatorias: ${obligatorias.join(", ")}`]);
    for (const def of CAMPOS_POR_TIPO[tipo]) {
      if (def.control === "opciones" && def.opciones) {
        instrucciones.push([`${HOJA_DE_TIPO[tipo]} → ${def.etiqueta}: ${def.opciones.map((o) => o.etiqueta).join(" | ")}`]);
      }
    }
  }
  const hojaInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones);
  hojaInstrucciones["!cols"] = [{ wch: 130 }];
  XLSX.utils.book_append_sheet(libro, hojaInstrucciones, "Instrucciones");

  for (const tipo of TIPOS_EN_LOTE) {
    const nombreHoja = HOJA_DE_TIPO[tipo];
    if (!nombreHoja) continue;
    const encabezados = encabezadosDeTipo(tipo);
    const filas = unidades.filter((u) => aplicaEnLote(tipo, u.slug)).map((u) => ({ [COL_UNIDAD]: u.etiqueta }) as Record<string, string>);
    XLSX.utils.book_append_sheet(libro, hojaConFormato(filas, encabezados), nombreHoja);
  }
  return escribirLibro(libro);
}

export type PrevisualizacionRegistros = { filas: FilaRegistro[]; problemas: ProblemaRegistro[]; hojasLeidas: string[]; error?: string };

export async function previsualizarRegistros(buffer: Buffer, cityIds: string[]): Promise<PrevisualizacionRegistros> {
  let libro: XLSX.WorkBook;
  try {
    libro = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return { filas: [], problemas: [], hojasLeidas: [], error: "No se pudo leer el archivo. ¿Es la plantilla en Excel (.xlsx)?" };
  }
  const porEtiqueta = new Map((await unidadesDe(cityIds)).map((u) => [normalizar(u.etiqueta), u]));
  const resolver = (texto: string): UnidadResuelta | null => porEtiqueta.get(normalizar(texto)) ?? null;

  const filas: FilaRegistro[] = [];
  const problemas: ProblemaRegistro[] = [];
  const hojasLeidas: string[] = [];
  for (const nombre of libro.SheetNames) {
    const tipo = tipoDeHoja(nombre) as TipoLote | null;
    if (!tipo) continue;
    hojasLeidas.push(nombre);
    const celdas = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[nombre], { header: 1, defval: null, raw: true });
    const r = leerHojaRegistros(tipo, nombre, celdas, resolver);
    filas.push(...r.filas);
    problemas.push(...r.problemas);
  }
  if (hojasLeidas.length === 0) {
    return { filas, problemas, hojasLeidas, error: `No se encontró ninguna hoja de registros (${Object.values(HOJA_DE_TIPO).join(", ")}). Usa la plantilla.` };
  }
  if (filas.length > MAX_FILAS_EXCEL) {
    return { filas: [], problemas, hojasLeidas, error: `El archivo trae ${filas.length} registros; el máximo por carga es ${MAX_FILAS_EXCEL}. Súbelo en partes.` };
  }
  return { filas, problemas, hojasLeidas };
}
