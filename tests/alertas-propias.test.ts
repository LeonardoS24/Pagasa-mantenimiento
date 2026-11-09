import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anclaDeCampo,
  anclaDeCampoFicha,
  camposFechaDeFicha,
  leerApartados,
  leerFechaDeCampo,
  nivelDeAlertaPropia,
  vencimientoDeAlertaPropia,
} from "../lib/alertas-catalogo";
import { anclaDeAlerta } from "../lib/anclas-unidad";
import { leerNormasVigentes } from "../lib/requisitos-runtime";

const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia));
const iso = (f: Date) => f.toISOString().slice(0, 10);

test("alerta agregada: vence a los años y meses de la fecha, o en la fecha misma", () => {
  assert.equal(iso(vencimientoDeAlertaPropia(d(2024, 3, 15), { modo: "PLAZO", plazoAnios: 1, plazoMeses: 0 })), "2025-03-15");
  assert.equal(iso(vencimientoDeAlertaPropia(d(2024, 11, 10), { modo: "PLAZO", plazoAnios: 0, plazoMeses: 6 })), "2025-05-10");
  // 31 de enero + 1 mes = último día de febrero, no 3 de marzo.
  assert.equal(iso(vencimientoDeAlertaPropia(d(2025, 1, 31), { modo: "PLAZO", plazoAnios: 0, plazoMeses: 1 })), "2025-02-28");
  assert.equal(iso(vencimientoDeAlertaPropia(d(2026, 7, 1), { modo: "VENCE", plazoAnios: 5, plazoMeses: 0 })), "2026-07-01");
});

test("alerta agregada: rojo a 7 días o menos, amarillo dentro del aviso", () => {
  assert.equal(nivelDeAlertaPropia(-3, 30), "red");
  assert.equal(nivelDeAlertaPropia(7, 30), "red");
  assert.equal(nivelDeAlertaPropia(20, 30), "yellow");
  assert.equal(nivelDeAlertaPropia(45, 30), "none");
  assert.equal(nivelDeAlertaPropia(45, 60), "yellow");
});

test("alerta agregada: lee la fecha de un campo agregado y la lista de apartados", () => {
  assert.equal(iso(leerFechaDeCampo("2026-02-03")!), "2026-02-03");
  assert.equal(leerFechaDeCampo(""), null);
  assert.equal(leerFechaDeCampo("ayer"), null);
  assert.deepEqual(leerApartados('["auto-tanques","semirremolques"]'), ["auto-tanques", "semirremolques"]);
  assert.deepEqual(leerApartados("no es json"), []);
  assert.ok(camposFechaDeFicha().some((c) => c.campo === "fechaFabricacionConectorFlexible"));
});

test("ver unidad: cada alerta lleva a su apartado", () => {
  assert.equal(anclaDeAlerta("ultrasonido", "auto-tanques"), "#ultrasonido");
  assert.equal(anclaDeAlerta("valvulas", "auto-tanques"), "#valvulas");
  assert.equal(anclaDeAlerta("mangueras", "vehiculo-con-tanque-de-carburacion"), "#mangueras");
  assert.equal(anclaDeAlerta("mangueras", "auto-tanques"), "#r-valvulas");
  assert.equal(anclaDeAlerta("dictamen", "semirremolques"), "#r-dictamenes");
  assert.equal(anclaDeAlerta("#r-x:abc", "auto-tanques"), "#r-x:abc");
  assert.equal(anclaDeCampo("x:abc"), "#r-x:abc");
  assert.equal(anclaDeCampo("visualExterna"), "#r-visual-externa");
  assert.equal(anclaDeCampoFicha("fechaFabricacionValvulaLlenado"), "#r-valvulas");
  assert.equal(anclaDeCampoFicha("fechaDictamenOperacion"), "#r-dictamenes");
  assert.equal(anclaDeCampoFicha("fechaProximaInspeccionVisualInterna"), "#r-visual-interna");
  assert.equal(anclaDeCampoFicha("fechaFabricacionTanque"), "#r-tanque");
});

test("normas que rigen: la lista guardada se valida y una dañada no se usa", () => {
  const ok = leerNormasVigentes(JSON.stringify([{ clave: "estaciones", area: "Estaciones", norma: "NOM-X", detalle: "", vigenteHasta: "2027-04-05" }]));
  assert.equal(ok?.[0].norma, "NOM-X");
  assert.equal(leerNormasVigentes(JSON.stringify([{ clave: "a", area: "", norma: "N", detalle: "" }])), null);
  assert.equal(leerNormasVigentes(JSON.stringify([{ clave: "a", area: "A", norma: "N", detalle: "", vigenteHasta: "5/4/27" }])), null);
  assert.equal(leerNormasVigentes("{dañado"), null);
});
