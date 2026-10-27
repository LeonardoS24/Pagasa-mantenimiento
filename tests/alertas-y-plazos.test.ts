// Los cálculos de vencimiento que respaldan las alertas, con los plazos del
// catálogo (lib/plazos.ts). Si alguien cambia una regla, aquí se nota.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PLAZOS_BASE, fijarPlazos } from "../lib/plazos";
import { aniosVigenciaValvulas, getValveVencimiento, valveDatesFromSheet } from "../lib/valve-alerts";
import { getStationValveVencimiento } from "../lib/station-valves";
import { getPlantaInstrumentVencimiento } from "../lib/planta-tank-instruments";
import { conectorParaAlerta, mangueraParaAlerta } from "../lib/hose-alerts";
import { getDictamenVencimiento, dictamenesDeApartado } from "../lib/dictamen-alerts";
import { avisosDeVigencia } from "../lib/requisitos-normativos";

const d = (a: number, m: number, dia: number) => new Date(Date.UTC(a, m - 1, dia));
const iso = (f: Date | null) => f?.toISOString().slice(0, 10) ?? null;

beforeEach(() => fijarPlazos({ ...PLAZOS_BASE }));

test("válvulas de unidad: 10 años en tanque de carga, 5 en carburación y en el resto", () => {
  assert.equal(aniosVigenciaValvulas("auto-tanques"), 10);
  assert.equal(aniosVigenciaValvulas("semirremolques"), 10);
  assert.equal(aniosVigenciaValvulas("vehiculo-con-tanque-de-carburacion"), 5);
  assert.equal(aniosVigenciaValvulas("unidades-utilitarias"), 5);
});

test("válvulas de unidad: cuenta desde la más antigua, incluidos manómetro y acoplamiento", () => {
  const fechas = valveDatesFromSheet({
    fechaFabricacionValvulaLlenado: d(2018, 5, 1),
    fechaFabricacionManometro: d(2017, 1, 10),
    fechaFabricacionAcoplamientoSeco: d(2016, 3, 3),
  });
  assert.equal(iso(getValveVencimiento(fechas, 10)), "2026-03-03");
  assert.equal(getValveVencimiento(valveDatesFromSheet(null), 10), null);
});

test("el plazo editado en el catálogo mueve la alerta", () => {
  fijarPlazos({ ...PLAZOS_BASE, valvulasTanqueCarga: 8 });
  assert.equal(aniosVigenciaValvulas("auto-tanques"), 8);
});

test("estaciones: 5 años de instaladas o 7 de fabricadas, lo que ocurra primero", () => {
  // Instaladas el mismo año que se fabricaron: manda la instalación (5).
  assert.equal(iso(getStationValveVencimiento({ fechaFabricacionValvulaLlenado: d(2020, 1, 1), fechaInstalacionValvulas: d(2020, 6, 1) })), "2025-06-01");
  // Instaladas 4 años después: manda la fabricación (7).
  assert.equal(iso(getStationValveVencimiento({ fechaFabricacionValvulaLlenado: d(2020, 1, 1), fechaInstalacionValvulas: d(2024, 1, 1) })), "2027-01-01");
  // Sin instalación: 5 desde fabricación (nunca avisa tarde).
  assert.equal(iso(getStationValveVencimiento({ fechaFabricacionValvulaLlenado: d(2020, 1, 1) })), "2025-01-01");
});

test("planta: 10 años desde el cambio o, si no hubo, desde la fabricación", () => {
  assert.equal(iso(getPlantaInstrumentVencimiento({ relevoPresionFechaFabricacion: d(2015, 2, 2) }, "relevoPresion")), "2025-02-02");
  assert.equal(
    iso(getPlantaInstrumentVencimiento({ relevoPresionFechaFabricacion: d(2015, 2, 2), relevoPresionFechaCambio: d(2022, 7, 7) }, "relevoPresion")),
    "2032-07-07"
  );
});

test("mangueras: trasiego solo en Auto-Tanques; carburación a 2 años; conector a 5", () => {
  const ficha = { fechaFabricacionMangueraSurtir: d(2022, 1, 1), fechaFabricacionManguera: d(2023, 1, 1), fechaFabricacionConectorFlexible: d(2021, 1, 1) };
  assert.deepEqual(mangueraParaAlerta("auto-tanques", ficha), { fecha: d(2022, 1, 1), anios: 5 });
  assert.equal(mangueraParaAlerta("semirremolques", ficha).fecha, null);
  assert.deepEqual(mangueraParaAlerta("vehiculo-con-tanque-de-carburacion", ficha), { fecha: d(2023, 1, 1), anios: 2 });
  assert.deepEqual(conectorParaAlerta("semirremolques", ficha), { fecha: d(2021, 1, 1), anios: 5 });
});

test("dictámenes: un año desde la emisión, según el apartado", () => {
  assert.equal(iso(getDictamenVencimiento(d(2026, 3, 15))), "2027-03-15");
  assert.deepEqual(dictamenesDeApartado("semirremolques").map((x) => x.campo).sort(), ["fechaDictamenNom068", "fechaDictamenOperacion"]);
  assert.deepEqual(dictamenesDeApartado("unidades-utilitarias"), []);
});

test("normas de emergencia: avisan 60 días antes de vencer (5-abr-2027)", () => {
  assert.equal(avisosDeVigencia(new Date(2026, 10, 1)).length, 0);
  const febrero = avisosDeVigencia(new Date(2027, 1, 10));
  assert.equal(febrero.length, 2);
  assert.ok(febrero.every((a) => a.nivel === "amarillo"));
  assert.ok(avisosDeVigencia(new Date(2027, 2, 20)).every((a) => a.nivel === "rojo"));
});
