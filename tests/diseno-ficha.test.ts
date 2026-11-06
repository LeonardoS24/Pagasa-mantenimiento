import test from "node:test";
import assert from "node:assert/strict";
import { leerDiseno, ordenPorDefecto, propsDeRecuadro, RECUADROS_FICHA } from "../lib/diseno-ficha";

test("sin diseño, cada recuadro sale en su lugar de siempre y a todo el ancho", () => {
  const p = propsDeRecuadro(undefined, "extintor", "extintor");
  assert.equal(p.style.order, ordenPorDefecto("extintor"));
  assert.equal(p.style.gridColumn, "1 / -1");
  assert.match(p.className, /border-l-red-400/);
  assert.ok(ordenPorDefecto("automovil") < ordenPorDefecto("hidrostatica"));
});

test("un diseño cambia orden, ancho y color de un recuadro", () => {
  const d = leerDiseno(JSON.stringify({ tanque: { orden: 5, ancho: "mitad", color: "extintor" } }));
  const p = propsDeRecuadro(d, "tanque", "tanque");
  assert.equal(p.style.order, 5);
  assert.equal(p.style.gridColumn, "span 1 / span 1");
  assert.match(p.className, /border-l-red-400/);
});

test("leerDiseno tolera basura y descarta valores inválidos", () => {
  assert.deepEqual(leerDiseno(null), {});
  assert.deepEqual(leerDiseno("no es json"), {});
  assert.deepEqual(leerDiseno("[1,2]"), {});
  const d = leerDiseno(JSON.stringify({ a: { orden: "x", ancho: "enorme", color: "verde" }, b: { ancho: "mitad" }, c: 7 }));
  assert.deepEqual(d, { b: { ancho: "mitad" } });
});

test("las claves de fábrica no se repiten", () => {
  const claves = RECUADROS_FICHA.map((r) => r.clave);
  assert.equal(new Set(claves).size, claves.length);
});
