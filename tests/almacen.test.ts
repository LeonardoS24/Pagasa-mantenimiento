// Lectura y comparación de la hoja de inventario de almacén (lib/almacen.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CIUDADES_ALMACEN,
  diffInventario,
  diffMovimientos,
  etiquetasDeUnidades,
  leerFechaHoja,
  leerInventario,
  leerMovimientos,
  parsearCsv,
  type ArticuloGuardado,
} from "../lib/almacen";
import { idDeHoja } from "../lib/almacen-servidor";

const CSV_INVENTARIO = [
  "Código,Artículo,Categoría,Marca / Modelo,Unidad,Ubicación,Cantidad,Disponibles,Prestado a,Notas",
  ',,Equipos Estaciones,,,,,,,', // renglón de plantilla: solo categoría
  'KG-3S,"Medidor de gas, grande",Equipos de comercios,KumHo,Pieza,Estante A (Oficina),"1,250",3,,',
  ",Válvula de relevo,Válvulas,,Pieza,Almacén interno,10,10,,nueva",
  "KG-3S,Medidor repetido,Equipos,,,,1,1,,",
].join("\n");

const CSV_MOVIMIENTOS = [
  "Fecha,Movimiento,Artículo,Cantidad,Trabajador,Para qué / Dónde se usa,Notas,Unidad / Estación",
  "05/03/2026,Salida,Válvula de relevo,2,Manuel Torres,Cambio de válvulas,,KG-158 · Auto-Tanques · Hermosillo",
  "05/03/2026,Salida,Válvula de relevo,2,Manuel Torres,Cambio de válvulas,,KG-158 · Auto-Tanques · Hermosillo",
  ",,,,,,,",
  "31/02/2026,Entrada,Medidor de gas,1,Sandra López,,,",
  "06/03/2026,Salida,,1,,,,",
].join("\n");

test("almacén: por ahora solo Hermosillo", () => {
  assert.deepEqual(CIUDADES_ALMACEN, ["hermosillo"]);
});

test("CSV: comillas, comas dentro de una celda y saltos de línea", () => {
  assert.deepEqual(parsearCsv('a,"b, c","d ""x"""\r\n1,2,3\n'), [
    ["a", "b, c", 'd "x"'],
    ["1", "2", "3"],
  ]);
});

test("fechas de la hoja: dd/mm/aaaa y AAAA-MM-DD; las imposibles no se aceptan", () => {
  assert.equal(leerFechaHoja("05/03/2026"), "2026-03-05");
  assert.equal(leerFechaHoja("5/3/26"), "2026-03-05");
  assert.equal(leerFechaHoja("2026-03-05"), "2026-03-05");
  assert.equal(leerFechaHoja("31/02/2026"), null);
  assert.equal(leerFechaHoja("mañana"), null);
});

test("inventario: omite el renglón de plantilla, repetidos y lee cantidades con coma", () => {
  const { articulos, avisos } = leerInventario(parsearCsv(CSV_INVENTARIO));
  assert.equal(articulos.length, 2);
  assert.equal(articulos[0].articulo, "Medidor de gas, grande");
  assert.equal(articulos[0].cantidad, 1250);
  assert.equal(articulos[1].codigo, null);
  assert.equal(articulos[1].clave, "A:valvula de relevo"); // sin código se reconoce por el nombre
  assert.ok(avisos.some((a) => a.includes("repetido")));
});

test("inventario: sin fila de encabezados avisa en vez de inventar", () => {
  const r = leerInventario([["hola", "mundo"]]);
  assert.equal(r.articulos.length, 0);
  assert.equal(r.avisos.length, 1);
});

test("movimientos: dos iguales no se confunden, vacíos y sin artículo se omiten, fecha mala se avisa", () => {
  const { movimientos, avisos } = leerMovimientos(parsearCsv(CSV_MOVIMIENTOS));
  assert.equal(movimientos.length, 3);
  assert.equal(movimientos[0].huella, movimientos[1].huella);
  assert.deepEqual([movimientos[0].repeticion, movimientos[1].repeticion], [0, 1]);
  assert.equal(movimientos[0].unidad, "KG-158 · Auto-Tanques · Hermosillo");
  assert.equal(movimientos[2].fecha, null);
  assert.equal(movimientos[2].fechaTexto, "31/02/2026");
  assert.ok(avisos.some((a) => a.includes("31/02/2026")));
  assert.ok(avisos.some((a) => a.includes("no tiene «Artículo»")));
});

const guardado = (clave: string, articulo: string, extra: Partial<ArticuloGuardado> = {}): ArticuloGuardado => ({
  clave,
  codigo: null,
  articulo,
  categoria: null,
  marca: null,
  unidad: null,
  ubicacion: null,
  cantidad: null,
  disponibles: null,
  prestadoA: null,
  notas: null,
  activo: true,
  ...extra,
});

test("comparación: nuevo, cambio con antes → después, ausente (no se borra) y reactivar", () => {
  const { articulos } = leerInventario(parsearCsv(CSV_INVENTARIO));
  const dif = diffInventario(
    [
      guardado("C:KG-3S", "Medidor de gas, grande", { codigo: "KG-3S", categoria: "Equipos de comercios", marca: "KumHo", unidad: "Pieza", ubicacion: "Estante A (Oficina)", cantidad: 1000, disponibles: 3 }),
      guardado("A:tornillo", "Tornillo"),
      guardado("A:valvula de relevo", "Válvula de relevo", { activo: false, categoria: "Válvulas", unidad: "Pieza", ubicacion: "Almacén interno", cantidad: 10, disponibles: 10, notas: "nueva" }),
    ],
    articulos
  );
  const por = (t: string) => dif.filter((d) => d.tipo === t);
  assert.equal(por("nuevo").length, 0);
  assert.equal(por("cambio").length, 1);
  assert.deepEqual(por("cambio")[0].cambios, [{ campo: "Cantidad", antes: "1000", despues: "1250" }]);
  assert.equal(por("reactivar").length, 1);
  assert.equal(por("ausente").length, 1);
  assert.equal(por("ausente")[0].articulo, "Tornillo");
});

test("comparación: si la hoja es igual a lo guardado no hay nada que aprobar", () => {
  const { articulos } = leerInventario(parsearCsv(CSV_INVENTARIO));
  const dif = diffInventario(articulos.map((a) => ({ ...a, activo: true })), articulos);
  assert.equal(dif.length, 0);
  const { movimientos } = leerMovimientos(parsearCsv(CSV_MOVIMIENTOS));
  const r = diffMovimientos(movimientos, movimientos);
  assert.equal(r.cambios.length, 0);
  assert.equal(r.ausentes, 0);
});

test("movimientos: corregir una nota es un cambio, no un movimiento nuevo; lo que falta en la hoja solo se cuenta", () => {
  const { movimientos } = leerMovimientos(parsearCsv(CSV_MOVIMIENTOS));
  const editado = movimientos.map((m, i) => (i === 0 ? { ...m, notas: "corregido" } : m));
  const r = diffMovimientos(movimientos, editado.slice(0, 2));
  assert.equal(r.cambios.length, 1);
  assert.equal(r.cambios[0].tipo, "cambio");
  assert.deepEqual(r.cambios[0].cambios, [{ campo: "Notas", antes: "—", despues: "corregido" }]);
  assert.equal(r.ausentes, 1);
});

test("etiquetas de unidades: una por unidad, con número si dos salen iguales", () => {
  const e = etiquetasDeUnidades([
    { id: "1", nombre: "KG-158", apartado: "Auto-Tanques", ciudad: "Hermosillo" },
    { id: "2", nombre: "KG-158", apartado: "Auto-Tanques", ciudad: "Hermosillo" },
    { id: "3", nombre: "Estación Centro", apartado: "Estaciones de carburación", ciudad: "Hermosillo" },
  ]);
  assert.equal(e[0].etiqueta, "KG-158 · Auto-Tanques · Hermosillo");
  assert.equal(e[1].etiqueta, "KG-158 · Auto-Tanques · Hermosillo (2)");
  assert.equal(new Set(e.map((x) => x.etiqueta)).size, 3);
});

test("enlace de la hoja: solo Google Sheets, nada de otras direcciones", () => {
  assert.equal(idDeHoja("https://docs.google.com/spreadsheets/d/1b6apIDQQkmETPSTFtbgbrG9U4KLiXeIlOM0fHmzGYhc/edit?gid=1#gid=1"), "1b6apIDQQkmETPSTFtbgbrG9U4KLiXeIlOM0fHmzGYhc");
  assert.equal(idDeHoja("http://docs.google.com/spreadsheets/d/1b6apIDQQkmETPSTFtbgbrG9U4KLiXeIlOM0fHmzGYhc"), null);
  assert.equal(idDeHoja("https://evil.example.com/spreadsheets/d/1b6apIDQQkmETPSTFtbgbrG9U4KLiXeIlOM0fHmzGYhc"), null);
  assert.equal(idDeHoja("https://docs.google.com.evil.example.com/spreadsheets/d/1b6apIDQQkmETPSTFtbgbrG9U4KLiXeIlOM0fHmzGYhc"), null);
  assert.equal(idDeHoja("http://localhost:3000"), null);
});
