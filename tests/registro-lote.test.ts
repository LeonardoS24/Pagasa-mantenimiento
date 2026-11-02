// A qué unidades se les puede registrar cada tipo en lote (lib/registro-lote.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { TIPOS_EN_LOTE, aplicaEnLote, esTipoEnLote } from "../lib/registro-lote";
import { CAMPOS_POR_TIPO } from "../lib/lote-documentos";

test("registro en lote: «otro documento» no es un tipo en lote y los tipos se validan", () => {
  assert.equal(TIPOS_EN_LOTE.includes("UNIDAD"), false);
  assert.equal(esTipoEnLote("EXTINTOR"), true);
  assert.equal(esTipoEnLote("UNIDAD"), false);
  assert.equal(esTipoEnLote("cualquier cosa"), false);
  assert.equal(esTipoEnLote(undefined), false);
});

test("registro en lote: cada tipo pide los campos de su bitácora", () => {
  for (const tipo of TIPOS_EN_LOTE) {
    assert.ok(CAMPOS_POR_TIPO[tipo].some((c) => c.requerido), `${tipo} debe tener algún campo obligatorio`);
  }
});

test("registro en lote: las pruebas de tanque no van en lote para estaciones y planta (van por tanque)", () => {
  assert.equal(aplicaEnLote("HERMETICIDAD", "auto-tanques"), true);
  assert.equal(aplicaEnLote("HERMETICIDAD", "estaciones-de-carburacion"), false);
  assert.equal(aplicaEnLote("ULTRASONIDO", "planta-ficha-tecnica"), false);
});

test("registro en lote: mangueras solo en carburación; extintor una sola vez (reparto, no su gemelo)", () => {
  assert.equal(aplicaEnLote("MANGUERAS", "vehiculo-con-tanque-de-carburacion"), true);
  assert.equal(aplicaEnLote("MANGUERAS", "auto-tanques"), false);
  assert.equal(aplicaEnLote("EXTINTOR", "vehiculo-de-reparto"), true);
  assert.equal(aplicaEnLote("EXTINTOR", "vehiculo-con-tanque-de-carburacion"), false);
  assert.equal(aplicaEnLote("EXTINTOR", "estaciones-de-carburacion"), false);
});
