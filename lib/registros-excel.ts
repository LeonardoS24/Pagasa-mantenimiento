import { CAMPOS_POR_TIPO, type CampoItem, type DefCampo, type TipoLote } from "@/lib/lote-documentos";
import { aplicaEnLote } from "@/lib/registro-lote";
import { leerFecha } from "@/lib/carga-fechas";
import { normalizar } from "@/lib/almacen";

// Registros nuevos de bitácora desde Excel (ver /ciudades/[c]/registros-desde-excel):
// una hoja por tipo de registro, un renglón por registro nuevo, con las MISMAS
// columnas y obligatorios que el formulario de esa bitácora (CAMPOS_POR_TIPO).
// Lo puro: leer y validar. Sin Prisma ni archivos, para probarlo con datos
// inventados (tests/registros-excel.test.ts).

export const HOJA_DE_TIPO: Partial<Record<TipoLote, string>> = {
  ULTRASONIDO: "Ultrasonido",
  VISUAL_EXTERNA: "Visual externa",
  HERMETICIDAD: "Hermeticidad",
  VISUAL_INTERNA: "Visual interna",
  HIDROSTATICA: "Hidrostática",
  MANTENIMIENTO: "Mantenimiento",
  EXTINTOR: "Extintor",
  MANGUERAS: "Mangueras",
  POLIZA: "Póliza",
};

export const COL_UNIDAD = "Unidad";
export const MAX_FILAS_EXCEL = 500;

export function tipoDeHoja(nombre: string): TipoLote | null {
  const n = normalizar(nombre);
  const hallado = (Object.entries(HOJA_DE_TIPO) as [TipoLote, string][]).find(([, h]) => normalizar(h) === n);
  return hallado ? hallado[0] : null;
}

export function encabezadosDeTipo(tipo: TipoLote): string[] {
  return [COL_UNIDAD, ...CAMPOS_POR_TIPO[tipo].map((d) => d.etiqueta)];
}

export type UnidadResuelta = { id: string; nombre: string; slug: string };

export type FilaRegistro = {
  tipo: TipoLote;
  hoja: string;
  fila: number; // renglón en el Excel
  vehicleId: string;
  unidad: string;
  valores: Partial<Record<CampoItem, string>>;
};
export type ProblemaRegistro = { hoja: string; fila: number; mensaje: string };

const vacia = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

function convertir(def: DefCampo, crudo: unknown): { valor: string } | { error: string } {
  if (vacia(crudo)) return { valor: "" };
  if (def.control === "fecha") {
    const f = leerFecha(crudo);
    if (f.tipo === "fecha") return { valor: f.fecha.toISOString().slice(0, 10) };
    if (f.tipo === "borrar") return { error: `«${def.etiqueta}»: BORRAR no aplica en un registro nuevo` };
    return { error: `«${def.etiqueta}»: ${f.tipo === "error" ? f.texto : "fecha inválida"}` };
  }
  if (def.control === "numero") {
    const n = Number(String(crudo).trim().replace(/,/g, ""));
    return Number.isFinite(n) ? { valor: String(n) } : { error: `«${def.etiqueta}»: «${String(crudo).trim()}» no es un número` };
  }
  if (def.control === "opciones") {
    const buscado = normalizar(crudo);
    const op = def.opciones?.find((o) => normalizar(o.valor) === buscado || normalizar(o.etiqueta) === buscado);
    if (op) return { valor: op.valor };
    return { error: `«${def.etiqueta}»: «${String(crudo).trim()}» no es una opción válida (${def.opciones?.map((o) => o.etiqueta).join(", ")})` };
  }
  // texto: un número de Excel (p. ej. el número de una prueba) se toma tal cual.
  if (crudo instanceof Date) return { error: `«${def.etiqueta}»: trae una fecha y aquí va texto` };
  return { valor: String(crudo).replace(/\s+/g, " ").trim() };
}

// Lee una hoja (matriz de celdas, primera fila = encabezados) de un tipo de
// registro. Los renglones con la unidad puesta pero sin ningún dato se omiten
// en silencio (la plantilla trae todas las unidades precargadas).
export function leerHojaRegistros(
  tipo: TipoLote,
  hoja: string,
  celdas: unknown[][],
  resolverUnidad: (texto: string) => UnidadResuelta | null
): { filas: FilaRegistro[]; problemas: ProblemaRegistro[] } {
  const problemas: ProblemaRegistro[] = [];
  const filas: FilaRegistro[] = [];
  if (celdas.length === 0) return { filas, problemas };

  const defs = CAMPOS_POR_TIPO[tipo];
  const encabezado = celdas[0].map((c) => normalizar(c));
  const iUnidad = encabezado.indexOf(normalizar(COL_UNIDAD));
  if (iUnidad < 0) {
    problemas.push({ hoja, fila: 1, mensaje: `Falta la columna «${COL_UNIDAD}». Usa la plantilla que se descarga de esta pantalla.` });
    return { filas, problemas };
  }
  const columnas = defs.map((d) => ({ def: d, i: encabezado.indexOf(normalizar(d.etiqueta)) }));
  const sinColumna = columnas.filter((c) => c.i < 0 && c.def.requerido);
  if (sinColumna.length > 0) {
    problemas.push({ hoja, fila: 1, mensaje: `Faltan columnas obligatorias: ${sinColumna.map((c) => `«${c.def.etiqueta}»`).join(", ")}.` });
    return { filas, problemas };
  }

  const vistos = new Set<string>();
  celdas.slice(1).forEach((fila, k) => {
    const numero = k + 2; // la 1 es el encabezado
    if (!Array.isArray(fila)) return;
    const hayDatos = columnas.some((c) => c.i >= 0 && !vacia(fila[c.i]));
    if (!hayDatos) return;

    const textoUnidad = String(fila[iUnidad] ?? "").trim();
    if (!textoUnidad) {
      problemas.push({ hoja, fila: numero, mensaje: "Tiene datos pero no dice la unidad." });
      return;
    }
    const unidad = resolverUnidad(textoUnidad);
    if (!unidad) {
      problemas.push({ hoja, fila: numero, mensaje: `La unidad «${textoUnidad}» no existe en el sistema o no es de esta ciudad (escríbela como sale en la plantilla).` });
      return;
    }
    if (!aplicaEnLote(tipo, unidad.slug)) {
      problemas.push({ hoja, fila: numero, mensaje: `A ${unidad.nombre} no se le registra «${hoja}» en lote.` });
      return;
    }

    const valores: Partial<Record<CampoItem, string>> = {};
    const errores: string[] = [];
    for (const { def, i } of columnas) {
      const r = convertir(def, i >= 0 ? fila[i] : null);
      if ("error" in r) errores.push(r.error);
      else if (r.valor) valores[def.campo] = r.valor;
    }
    for (const { def } of columnas) {
      if (def.requerido && !valores[def.campo] && !errores.some((e) => e.startsWith(`«${def.etiqueta}»`))) {
        errores.push(`falta «${def.etiqueta}»`);
      }
    }
    if (errores.length > 0) {
      problemas.push({ hoja, fila: numero, mensaje: `${unidad.nombre}: ${errores.join("; ")}.` });
      return;
    }

    // Dos renglones iguales en el mismo archivo casi siempre son un error de
    // copiar y pegar, y cada uno crearía un registro.
    const huella = `${unidad.id}|${tipo}|${valores.fechaRealizacion ?? ""}|${valores.numero ?? ""}`;
    if (vistos.has(huella)) {
      problemas.push({ hoja, fila: numero, mensaje: `${unidad.nombre}: está repetido en esta hoja (misma unidad, fecha y número); se omitió.` });
      return;
    }
    vistos.add(huella);
    filas.push({ tipo, hoja, fila: numero, vehicleId: unidad.id, unidad: unidad.nombre, valores });
  });
  return { filas, problemas };
}
