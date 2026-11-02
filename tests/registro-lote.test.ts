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

test("registro en lote: el número de cada dictamen es por unidad y obligatorio; extintor y póliza van iguales para todas", async () => {
  const { camposPorUnidad, camposObligatoriosEnLote, numeroObligatorioEnLote } = await import("../lib/registro-lote");
  for (const t of ["ULTRASONIDO", "VISUAL_EXTERNA", "HERMETICIDAD", "VISUAL_INTERNA", "HIDROSTATICA"] as const) {
    assert.deepEqual(camposPorUnidad(t), ["numero"], t);
    assert.ok(camposObligatoriosEnLote(t).includes("numero"), t);
    assert.equal(numeroObligatorioEnLote(t), true);
  }
  assert.deepEqual(camposPorUnidad("EXTINTOR"), []);
  assert.deepEqual(camposPorUnidad("POLIZA"), []);
  assert.equal(camposObligatoriosEnLote("POLIZA").includes("numero"), false);
  assert.deepEqual(camposPorUnidad("MANTENIMIENTO"), ["kilometraje"]);
  // Todo campo por unidad existe en los campos de su tipo.
  for (const t of TIPOS_EN_LOTE) {
    for (const c of camposPorUnidad(t)) assert.ok(CAMPOS_POR_TIPO[t].some((d) => d.campo === c), `${t}.${c}`);
  }
});

test("registro en lote: números repetidos entre unidades se detectan sin importar mayúsculas, espacios ni guiones", async () => {
  const { numerosRepetidos, claveDeNumero } = await import("../lib/registro-lote");
  assert.equal(claveDeNumero("US-012"), claveDeNumero("us 012"));
  const r = numerosRepetidos([
    { unidad: "AT-1", numero: "US-012" },
    { unidad: "AT-2", numero: "us 012" },
    { unidad: "AT-3", numero: "US-013" },
    { unidad: "AT-4", numero: "" },
    { unidad: "AT-5", numero: "  " },
  ]);
  assert.equal(r.length, 1);
  assert.deepEqual(r[0].unidades, ["AT-1", "AT-2"]);
  assert.deepEqual(numerosRepetidos([{ unidad: "A", numero: "1" }, { unidad: "B", numero: "2" }]), []);
});

test("registro en lote: numerar en serie respeta el prefijo y los ceros a la izquierda", async () => {
  const { numerarEnSerie } = await import("../lib/registro-lote");
  assert.deepEqual(numerarEnSerie("US-", "1", 3), ["US-1", "US-2", "US-3"]);
  assert.deepEqual(numerarEnSerie("US-", "007", 3), ["US-007", "US-008", "US-009"]);
  assert.deepEqual(numerarEnSerie("", "98", 3), ["98", "99", "100"]);
  assert.deepEqual(numerarEnSerie("X", "abc", 3), []);
  assert.deepEqual(numerarEnSerie("X", "1", 0), []);
});
