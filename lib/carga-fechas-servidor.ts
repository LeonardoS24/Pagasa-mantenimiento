import { prisma } from "./prisma";
import { XLSX, escribirLibro, hojaConFormato } from "./excel-formato";
import { logActivity } from "./activity-log";
import type { UsuarioSesion } from "./session";
import {
  APARTADOS_CON_PLANTILLA,
  PALABRA_BORRAR,
  columnasDeApartado,
  leerFecha,
  textoFecha,
  type CambioFecha,
  type ProblemaCarga,
} from "./carga-fechas";

// Plantilla de Excel y lectura de la que regresa (ver lib/carga-fechas.ts).

const HOJA_DE_APARTADO: Record<string, string> = {
  "auto-tanques": "Auto-Tanques",
  semirremolques: "Semirremolques",
  "vehiculo-con-tanque-de-carburacion": "Carburación",
  tractocamiones: "Tractocamiones",
};
const APARTADO_DE_HOJA = Object.fromEntries(Object.entries(HOJA_DE_APARTADO).map(([a, h]) => [h, a]));
const COL_ID = "Id del sistema";
const COL_CIUDAD = "Ciudad";
const COL_NUMERO = "Número económico";

async function unidadesDe(cityIds: string[]) {
  return prisma.vehicleRecord.findMany({
    where: { activo: true, section: { cityId: { in: cityIds }, slug: { in: [...APARTADOS_CON_PLANTILLA] } } },
    include: { technicalSheet: true, section: { include: { city: true } } },
    orderBy: [{ section: { city: { order: "asc" } } }, { numeroEconomico: "asc" }],
  });
}

const INSTRUCCIONES = [
  ["Cómo usar esta plantilla"],
  [""],
  ["1. Cada hoja es un tipo de unidad. Cada renglón es una unidad; cada columna, una fecha de su ficha técnica."],
  ["2. Escribe o corrige las fechas en formato dd/mm/aaaa (por ejemplo 05/03/2024)."],
  ["3. Una celda vacía NO borra nada. Para borrar una fecha guardada escribe " + PALABRA_BORRAR + "."],
  ["4. No cambies los encabezados ni la columna «" + COL_ID + "»: es como el sistema sabe de qué unidad es cada renglón."],
  ["5. Súbela en «Carga de fechas»: el sistema te muestra cada cambio (antes → después) y no guarda nada hasta que lo confirmes."],
  [""],
  ["Las estaciones y la planta no vienen aquí: sus pruebas y válvulas van por tanque, en su propia ficha."],
];

export async function armarPlantilla(cityIds: string[]): Promise<Buffer> {
  const unidades = await unidadesDe(cityIds);
  const libro = XLSX.utils.book_new();
  const instrucciones = XLSX.utils.aoa_to_sheet(INSTRUCCIONES);
  instrucciones["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(libro, instrucciones, "Instrucciones");

  for (const slug of APARTADOS_CON_PLANTILLA) {
    const deEste = unidades.filter((u) => u.section.slug === slug);
    if (deEste.length === 0) continue;
    const columnas = columnasDeApartado(slug);
    const encabezados = [COL_CIUDAD, COL_NUMERO, ...columnas.map((c) => c.encabezado), COL_ID];
    const filas = deEste.map((u) => {
      const fila: Record<string, string> = { [COL_CIUDAD]: u.section.city.name, [COL_NUMERO]: u.numeroEconomico, [COL_ID]: u.id };
      for (const c of columnas) fila[c.encabezado] = textoFecha(u.technicalSheet?.[c.campo] as Date | null | undefined);
      return fila;
    });
    XLSX.utils.book_append_sheet(libro, hojaConFormato(filas, encabezados), HOJA_DE_APARTADO[slug]);
  }
  return escribirLibro(libro);
}

export type Previsualizacion = { cambios: CambioFecha[]; problemas: ProblemaCarga[]; filasLeidas: number };

export async function previsualizar(buffer: Buffer, cityIds: string[]): Promise<Previsualizacion> {
  let libro: XLSX.WorkBook;
  try {
    libro = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return { cambios: [], problemas: [{ hoja: "", fila: 0, mensaje: "No se pudo leer el archivo. ¿Es la plantilla en Excel (.xlsx)?" }], filasLeidas: 0 };
  }
  const unidades = new Map((await unidadesDe(cityIds)).map((u) => [u.id, u]));
  const cambios: CambioFecha[] = [];
  const problemas: ProblemaCarga[] = [];
  let filasLeidas = 0;

  for (const nombreHoja of libro.SheetNames) {
    const slug = APARTADO_DE_HOJA[nombreHoja];
    if (!slug) continue;
    const columnas = columnasDeApartado(slug);
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets[nombreHoja], { defval: null, raw: true });
    filas.forEach((fila, i) => {
      const numeroFila = i + 2; // la 1 es el encabezado
      const id = String(fila[COL_ID] ?? "").trim();
      if (!id) {
        if (Object.values(fila).some((v) => v !== null && String(v).trim() !== "")) {
          problemas.push({ hoja: nombreHoja, fila: numeroFila, mensaje: `Sin «${COL_ID}»: no se sabe de qué unidad es.` });
        }
        return;
      }
      const unidad = unidades.get(id);
      if (!unidad) {
        problemas.push({ hoja: nombreHoja, fila: numeroFila, mensaje: "Esa unidad no existe, está dada de baja o no es de esta ciudad." });
        return;
      }
      if (unidad.section.slug !== slug) {
        problemas.push({ hoja: nombreHoja, fila: numeroFila, mensaje: `${unidad.numeroEconomico} no es de esta hoja (${nombreHoja}).` });
        return;
      }
      filasLeidas++;
      for (const c of columnas) {
        if (!(c.encabezado in fila)) continue;
        const leido = leerFecha(fila[c.encabezado]);
        const actual = (unidad.technicalSheet?.[c.campo] as Date | null | undefined) ?? null;
        if (leido.tipo === "vacio") continue;
        if (leido.tipo === "error") {
          problemas.push({ hoja: nombreHoja, fila: numeroFila, mensaje: `${unidad.numeroEconomico}, ${c.encabezado}: ${leido.texto}.` });
          continue;
        }
        const nueva = leido.tipo === "borrar" ? null : leido.fecha;
        if ((nueva?.getTime() ?? null) === (actual?.getTime() ?? null)) continue;
        cambios.push({
          vehicleId: unidad.id,
          numeroEconomico: unidad.numeroEconomico,
          apartado: nombreHoja,
          campo: c.campo,
          etiqueta: c.encabezado,
          antes: actual?.toISOString() ?? null,
          despues: nueva?.toISOString() ?? null,
        });
      }
    });
  }
  return { cambios, problemas, filasLeidas };
}

export type ResultadoAplicar = { aplicados: number; unidades: number; omitidos: string[] };

// Los cambios llegan del navegador: se revalida TODO (ciudad, campo permitido
// para ese tipo de unidad, fecha) y se omite lo que cambió en el sistema
// desde la vista previa (alguien lo editó mientras tanto).
export async function aplicarCambios(cambios: CambioFecha[], cityIds: string[], user: UsuarioSesion): Promise<ResultadoAplicar> {
  const unidades = new Map((await unidadesDe(cityIds)).map((u) => [u.id, u]));
  const porUnidad = new Map<string, Record<string, Date | null>>();
  const resumen = new Map<string, string[]>();
  const omitidos: string[] = [];

  for (const c of cambios) {
    const unidad = unidades.get(c.vehicleId);
    if (!unidad) {
      omitidos.push(`${c.numeroEconomico}: ya no está disponible.`);
      continue;
    }
    const columna = columnasDeApartado(unidad.section.slug).find((col) => col.campo === c.campo);
    if (!columna) {
      omitidos.push(`${c.numeroEconomico}: «${c.etiqueta}» no aplica a este tipo de unidad.`);
      continue;
    }
    const actual = (unidad.technicalSheet?.[columna.campo] as Date | null | undefined) ?? null;
    if ((actual?.toISOString() ?? null) !== c.antes) {
      omitidos.push(`${c.numeroEconomico}, ${columna.encabezado}: cambió en el sistema después de la vista previa.`);
      continue;
    }
    const nueva = c.despues === null ? null : new Date(c.despues);
    if (nueva && Number.isNaN(nueva.getTime())) {
      omitidos.push(`${c.numeroEconomico}, ${columna.encabezado}: fecha inválida.`);
      continue;
    }
    const datos = porUnidad.get(unidad.id) ?? {};
    datos[columna.campo] = nueva;
    porUnidad.set(unidad.id, datos);
    resumen.set(unidad.id, [...(resumen.get(unidad.id) ?? []), `${columna.encabezado}: ${textoFecha(actual) || "vacío"} → ${textoFecha(nueva) || "borrada"}`]);
  }

  let aplicados = 0;
  for (const [vehicleId, datos] of porUnidad) {
    const unidad = unidades.get(vehicleId)!;
    await prisma.vehicleTechnicalSheet.upsert({
      where: { vehicleRecordId: vehicleId },
      update: datos,
      create: { vehicleRecordId: vehicleId, ...datos },
    });
    aplicados += Object.keys(datos).length;
    await logActivity({
      user,
      accion: "EDITAR",
      entidad: "Ficha técnica (carga de fechas desde Excel)",
      resumen: unidad.numeroEconomico,
      detalle: resumen.get(vehicleId)!.join(" · "),
      citySlug: unidad.section.city.slug,
    });
  }
  return { aplicados, unidades: porUnidad.size, omitidos };
}
