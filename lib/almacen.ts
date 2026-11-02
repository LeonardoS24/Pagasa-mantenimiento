import { createHash } from "node:crypto";

// Inventario de almacén llevado en una hoja de Google (ver AlmacenConfig en el
// schema). Este archivo es lo puro: leer las pestañas "Inventario" y
// "Movimientos" (CSV), normalizarlas y compararlas con lo que ya tiene el
// sistema. Sin Prisma ni red: lo prueban tests/almacen.test.ts.

// Por ahora el almacén solo funciona en Hermosillo (de ahí sale el inventario).
export const CIUDADES_ALMACEN = ["hermosillo"];
export const HOJA_INVENTARIO = "Inventario";
export const HOJA_MOVIMIENTOS = "Movimientos";

export type ArticuloHoja = {
  clave: string;
  codigo: string | null;
  articulo: string;
  categoria: string | null;
  marca: string | null;
  unidad: string | null;
  ubicacion: string | null;
  cantidad: number | null;
  disponibles: number | null;
  prestadoA: string | null;
  notas: string | null;
};

export type MovimientoHoja = {
  huella: string;
  repeticion: number;
  fecha: string | null; // AAAA-MM-DD
  fechaTexto: string | null;
  movimiento: string | null;
  articulo: string;
  cantidad: number | null;
  trabajador: string | null;
  paraQue: string | null;
  notas: string | null;
  unidad: string | null; // «Unidad / Estación» tal como viene de la lista
};

export type LecturaHoja = {
  articulos: ArticuloHoja[];
  movimientos: MovimientoHoja[];
  avisos: string[];
  leidaEl: string;
};

// ── CSV ──────────────────────────────────────────────────────────────────

export function parsearCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  const s = texto.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (entreComillas) {
      if (c === '"' && s[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ",") {
      fila.push(celda);
      celda = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      fila.push(celda);
      filas.push(fila);
      fila = [];
      celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length > 0) {
    fila.push(celda);
    filas.push(fila);
  }
  return filas;
}

// ── Normalización ────────────────────────────────────────────────────────

export function normalizar(texto: unknown): string {
  return String(texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function texto(v: unknown): string | null {
  const t = String(v ?? "").replace(/\s+/g, " ").trim();
  return t === "" ? null : t;
}

export function leerNumero(v: unknown): number | null {
  const t = String(v ?? "").trim().replace(/,/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// dd/mm/aaaa (así las escribe el equipo) o AAAA-MM-DD. null si no se entiende.
export function leerFechaHoja(v: unknown): string | null {
  const t = String(v ?? "").trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  let a: number, mes: number, d: number;
  if (m) {
    [a, mes, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(t);
    if (!m) return null;
    [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (a < 100) a += 2000;
  }
  const f = new Date(Date.UTC(a, mes - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== d) return null;
  return f.toISOString().slice(0, 10);
}

// Encabezado de la hoja → campo. Se reconoce por el nombre, sin importar el
// orden de las columnas ni los acentos.
function campoDeInventario(encabezado: string): keyof ArticuloHoja | null {
  const n = normalizar(encabezado);
  if (n === "codigo") return "codigo";
  if (n === "articulo") return "articulo";
  if (n === "categoria") return "categoria";
  if (n.startsWith("marca")) return "marca";
  if (n === "unidad") return "unidad";
  if (n === "ubicacion") return "ubicacion";
  if (n === "cantidad") return "cantidad";
  if (n === "disponibles") return "disponibles";
  if (n.startsWith("prestado")) return "prestadoA";
  if (n === "notas") return "notas";
  return null;
}

function campoDeMovimiento(encabezado: string): keyof MovimientoHoja | null {
  const n = normalizar(encabezado);
  if (n === "fecha") return "fecha";
  if (n === "movimiento") return "movimiento";
  if (n === "articulo") return "articulo";
  if (n === "cantidad") return "cantidad";
  if (n === "trabajador") return "trabajador";
  if (n.startsWith("para que")) return "paraQue";
  if (n === "notas") return "notas";
  if (n.startsWith("unidad")) return "unidad";
  return null;
}

// Fila de encabezados: la primera que trae «Artículo» y al menos otra columna
// conocida (Google a veces antepone renglones).
function filaDeEncabezados(filas: string[][], campoDe: (e: string) => string | null): number {
  return filas.findIndex((f) => {
    const campos = f.map(campoDe).filter(Boolean);
    return campos.includes("articulo") && campos.length >= 3;
  });
}

export function claveDeArticulo(codigo: string | null, articulo: string): string {
  return codigo ? `C:${normalizar(codigo).toUpperCase()}` : `A:${normalizar(articulo)}`;
}

export function leerInventario(filas: string[][]): { articulos: ArticuloHoja[]; avisos: string[] } {
  const avisos: string[] = [];
  const cab = filaDeEncabezados(filas, campoDeInventario);
  if (cab < 0) return { articulos: [], avisos: ["En la pestaña «Inventario» no se encontró la fila de encabezados (Código, Artículo, Categoría…)."] };
  const columnas = filas[cab].map(campoDeInventario);
  const articulos: ArticuloHoja[] = [];
  const vistas = new Set<string>();
  filas.slice(cab + 1).forEach((fila, i) => {
    const v: Partial<Record<keyof ArticuloHoja, string>> = {};
    columnas.forEach((campo, j) => {
      if (campo && !(campo in v)) v[campo] = fila[j] ?? "";
    });
    const articulo = texto(v.articulo);
    if (!articulo) {
      // Un renglón con solo la categoría puesta (renglón de plantilla) no es un artículo.
      if (fila.some((c) => texto(c) && texto(c) !== texto(v.categoria))) {
        avisos.push(`Inventario, renglón ${cab + i + 2}: tiene datos pero no tiene «Artículo»; se omitió.`);
      }
      return;
    }
    const codigo = texto(v.codigo);
    const clave = claveDeArticulo(codigo, articulo);
    if (vistas.has(clave)) {
      avisos.push(`Inventario, renglón ${cab + i + 2}: «${articulo}» está repetido (mismo código); se tomó el primero.`);
      return;
    }
    vistas.add(clave);
    articulos.push({
      clave,
      codigo,
      articulo,
      categoria: texto(v.categoria),
      marca: texto(v.marca),
      unidad: texto(v.unidad),
      ubicacion: texto(v.ubicacion),
      cantidad: leerNumero(v.cantidad),
      disponibles: leerNumero(v.disponibles),
      prestadoA: texto(v.prestadoA),
      notas: texto(v.notas),
    });
  });
  return { articulos, avisos };
}

export function huellaDeMovimiento(m: Pick<MovimientoHoja, "fecha" | "fechaTexto" | "movimiento" | "articulo" | "cantidad" | "trabajador" | "unidad">): string {
  // No entran «Para qué» ni «Notas»: corregir una nota de un movimiento viejo
  // es un cambio de ese movimiento, no un movimiento nuevo.
  const base = [m.fecha ?? m.fechaTexto, m.movimiento, m.articulo, m.cantidad, m.trabajador, m.unidad].map((x) => normalizar(x)).join("|");
  return createHash("sha1").update(base).digest("hex").slice(0, 24);
}

export function leerMovimientos(filas: string[][]): { movimientos: MovimientoHoja[]; avisos: string[] } {
  const avisos: string[] = [];
  const cab = filaDeEncabezados(filas, campoDeMovimiento);
  if (cab < 0) return { movimientos: [], avisos: ["En la pestaña «Movimientos» no se encontró la fila de encabezados (Fecha, Movimiento, Artículo…)."] };
  const columnas = filas[cab].map(campoDeMovimiento);
  const movimientos: MovimientoHoja[] = [];
  const repetidas = new Map<string, number>();
  filas.slice(cab + 1).forEach((fila, i) => {
    const v: Partial<Record<keyof MovimientoHoja, string>> = {};
    columnas.forEach((campo, j) => {
      if (campo && !(campo in v)) v[campo] = fila[j] ?? "";
    });
    if (![v.fecha, v.movimiento, v.articulo, v.cantidad].some((x) => texto(x))) return; // renglón vacío
    const articulo = texto(v.articulo);
    if (!articulo) {
      avisos.push(`Movimientos, renglón ${cab + i + 2}: no tiene «Artículo»; se omitió.`);
      return;
    }
    const fechaTexto = texto(v.fecha);
    const fecha = fechaTexto ? leerFechaHoja(fechaTexto) : null;
    if (fechaTexto && !fecha) avisos.push(`Movimientos, renglón ${cab + i + 2}: la fecha «${fechaTexto}» no se entiende (usa dd/mm/aaaa); se guarda como texto.`);
    const base = {
      fecha,
      fechaTexto,
      movimiento: texto(v.movimiento),
      articulo,
      cantidad: leerNumero(v.cantidad),
      trabajador: texto(v.trabajador),
      unidad: texto(v.unidad),
    };
    const huella = huellaDeMovimiento(base);
    const repeticion = repetidas.get(huella) ?? 0;
    repetidas.set(huella, repeticion + 1);
    movimientos.push({ ...base, huella, repeticion, paraQue: texto(v.paraQue), notas: texto(v.notas) });
  });
  return { movimientos, avisos };
}

// ── Comparación con lo que ya tiene el sistema ───────────────────────────

export type ArticuloGuardado = ArticuloHoja & { activo: boolean };
export type MovimientoGuardado = Pick<MovimientoHoja, "huella" | "repeticion" | "paraQue" | "notas" | "articulo" | "fechaTexto"> & { fecha: string | null };

export type CambioCampo = { campo: string; antes: string; despues: string };
export type DifArticulo = {
  tipo: "nuevo" | "cambio" | "reactivar" | "ausente";
  clave: string;
  articulo: string;
  cambios: CambioCampo[];
};
export type DifMovimiento = { tipo: "nuevo" | "cambio"; movimiento: MovimientoHoja; cambios: CambioCampo[] };

const ETIQUETAS_ARTICULO: [keyof ArticuloHoja, string][] = [
  ["articulo", "Artículo"],
  ["categoria", "Categoría"],
  ["marca", "Marca / Modelo"],
  ["unidad", "Unidad"],
  ["ubicacion", "Ubicación"],
  ["cantidad", "Cantidad"],
  ["disponibles", "Disponibles"],
  ["prestadoA", "Prestado a"],
  ["notas", "Notas"],
  ["codigo", "Código"],
];

const mostrar = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));
const igual = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

export function diffInventario(guardados: ArticuloGuardado[], hoja: ArticuloHoja[]): DifArticulo[] {
  const porClave = new Map(guardados.map((g) => [g.clave, g]));
  const clavesHoja = new Set(hoja.map((h) => h.clave));
  const dif: DifArticulo[] = [];
  for (const h of hoja) {
    const g = porClave.get(h.clave);
    if (!g) {
      dif.push({ tipo: "nuevo", clave: h.clave, articulo: h.articulo, cambios: [] });
      continue;
    }
    const cambios: CambioCampo[] = [];
    for (const [campo, etiqueta] of ETIQUETAS_ARTICULO) {
      if (!igual(g[campo], h[campo])) cambios.push({ campo: etiqueta, antes: mostrar(g[campo]), despues: mostrar(h[campo]) });
    }
    if (!g.activo) dif.push({ tipo: "reactivar", clave: h.clave, articulo: h.articulo, cambios });
    else if (cambios.length > 0) dif.push({ tipo: "cambio", clave: h.clave, articulo: h.articulo, cambios });
  }
  for (const g of guardados) {
    if (g.activo && !clavesHoja.has(g.clave)) dif.push({ tipo: "ausente", clave: g.clave, articulo: g.articulo, cambios: [] });
  }
  return dif;
}

export function diffMovimientos(guardados: MovimientoGuardado[], hoja: MovimientoHoja[]): { cambios: DifMovimiento[]; ausentes: number } {
  const clave = (m: { huella: string; repeticion: number }) => `${m.huella}#${m.repeticion}`;
  const porClave = new Map(guardados.map((g) => [clave(g), g]));
  const enHoja = new Set(hoja.map(clave));
  const cambios: DifMovimiento[] = [];
  for (const h of hoja) {
    const g = porClave.get(clave(h));
    if (!g) {
      cambios.push({ tipo: "nuevo", movimiento: h, cambios: [] });
      continue;
    }
    const campos: CambioCampo[] = [];
    if (!igual(g.paraQue, h.paraQue)) campos.push({ campo: "Para qué / Dónde se usa", antes: mostrar(g.paraQue), despues: mostrar(h.paraQue) });
    if (!igual(g.notas, h.notas)) campos.push({ campo: "Notas", antes: mostrar(g.notas), despues: mostrar(h.notas) });
    if (campos.length > 0) cambios.push({ tipo: "cambio", movimiento: h, cambios: campos });
  }
  return { cambios, ausentes: guardados.filter((g) => !enHoja.has(clave(g))).length };
}

// Huella de TODO lo leído: sirve para no volver a avisar por la misma lectura.
export function huellaDeLectura(l: Pick<LecturaHoja, "articulos" | "movimientos">): string {
  return createHash("sha1").update(JSON.stringify([l.articulos, l.movimientos])).digest("hex").slice(0, 24);
}

// ── Etiqueta de unidad / estación (lista desplegable de la hoja) ─────────

export type UnidadDelSistema = { id: string; nombre: string; apartado: string; ciudad: string };

// «KG-158 · Auto-Tanques · Mexicali». Si dos salen iguales se les agrega un
// número para que cada etiqueta apunte a una sola unidad.
export function etiquetasDeUnidades(unidades: UnidadDelSistema[]): { id: string; etiqueta: string }[] {
  const usadas = new Map<string, number>();
  return unidades.map((u) => {
    const base = `${u.nombre} · ${u.apartado} · ${u.ciudad}`;
    const n = (usadas.get(base) ?? 0) + 1;
    usadas.set(base, n);
    return { id: u.id, etiqueta: n === 1 ? base : `${base} (${n})` };
  });
}
