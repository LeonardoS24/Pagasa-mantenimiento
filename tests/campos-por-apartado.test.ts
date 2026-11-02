// Campos y recuadros propios de las fichas, por apartado (lib/custom-fields.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CAMPO_APARTADOS,
  aplicaAApartado,
  esSeccionPropia,
  idDeSeccionPropia,
  labelDeApartado,
  labelDeSeccion,
  seccionDePropia,
  seccionesPara,
} from "../lib/custom-fields";

test("campos por apartado: sin apartado se ve en todos; con apartado, solo en ese", () => {
  assert.equal(aplicaAApartado(null, "auto-tanques"), true);
  assert.equal(aplicaAApartado("auto-tanques", "auto-tanques"), true);
  assert.equal(aplicaAApartado("auto-tanques", "semirremolques"), false);
  // Si no se sabe el apartado de la unidad, no se esconde nada.
  assert.equal(aplicaAApartado("auto-tanques", null), true);
});

test("recuadros propios: el id se guarda como x:<id> y no se confunde con los de fábrica", () => {
  const id = "clx123";
  assert.equal(seccionDePropia(id), "x:clx123");
  assert.equal(esSeccionPropia("x:clx123"), true);
  assert.equal(idDeSeccionPropia("x:clx123"), id);
  for (const ambito of ["VEHICULO", "ESTACION"] as const) {
    assert.ok(seccionesPara(ambito).every((s) => !esSeccionPropia(s.id)), "ningún recuadro de fábrica empieza con x:");
  }
});

test("etiquetas: apartado y recuadro (de fábrica o propio)", () => {
  assert.equal(labelDeApartado("VEHICULO", null), "Todos los apartados");
  assert.equal(labelDeApartado("VEHICULO", "auto-tanques"), "Auto-Tanques");
  assert.equal(labelDeSeccion("VEHICULO", "tanque"), "Tanque");
  const propias = [{ id: "abc", ambito: "VEHICULO" as const, apartadoSlug: null, titulo: "Requisitos nuevos", orden: 0 }];
  assert.equal(labelDeSeccion("VEHICULO", "x:abc", propias), "Requisitos nuevos");
  assert.equal(labelDeSeccion("VEHICULO", "x:no-existe", propias), "Recuadro nuevo");
});

test("apartados: cada ámbito tiene los suyos y los slugs no se repiten", () => {
  for (const ambito of ["VEHICULO", "ESTACION"] as const) {
    const slugs = CAMPO_APARTADOS[ambito].map((a) => a.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  }
  assert.ok(CAMPO_APARTADOS.VEHICULO.some((a) => a.slug === "auto-tanques"));
  assert.ok(CAMPO_APARTADOS.ESTACION.some((a) => a.slug === "planta-ficha-tecnica"));
});
