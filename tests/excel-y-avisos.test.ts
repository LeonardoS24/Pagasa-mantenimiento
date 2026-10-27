// Lectura de la plantilla de fechas, aviso de lo que pasa a rojo y el correo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { columnasDeApartado, leerFecha, textoFecha } from "../lib/carga-fechas";
import { claveDeAviso, nuevosEnRojo } from "../lib/aviso-rojo";
import { armarReporte } from "../lib/reporte-vencimientos";
import type { Vencimiento } from "../lib/vencimientos";

test("plantilla: lee dd/mm/aaaa, aaaa-mm-dd, número de Excel, BORRAR y vacío", () => {
  const f = (v: unknown) => {
    const r = leerFecha(v);
    return r.tipo === "fecha" ? r.fecha.toISOString().slice(0, 10) : r.tipo;
  };
  assert.equal(f("05/03/2024"), "2024-03-05");
  assert.equal(f("2024-03-05"), "2024-03-05");
  assert.equal(f(45444), "2024-06-01");
  assert.equal(f("borrar"), "borrar");
  assert.equal(f(""), "vacio");
  assert.equal(f(null), "vacio");
  assert.equal(f("31/02/2024"), "error");
  assert.equal(f("mañana"), "error");
  // La librería de Excel a veces entrega 23:59:59 del día anterior.
  assert.equal(f(new Date(2024, 5, 1, 0, 0, 0) ), "2024-06-01");
  assert.equal(f(new Date(2024, 4, 31, 23, 59, 59)), "2024-06-01");
  assert.equal(textoFecha(new Date(Date.UTC(2024, 2, 5))), "05/03/2024");
});

test("plantilla: columnas según el tipo de unidad", () => {
  const at = columnasDeApartado("auto-tanques").map((c) => c.campo);
  assert.ok(at.includes("fechaFabricacionMangueraSurtir") && at.includes("fechaFabricacionAcoplamientoSeco"));
  const sr = columnasDeApartado("semirremolques").map((c) => c.campo);
  assert.ok(!sr.includes("fechaFabricacionMangueraSurtir") && sr.includes("fechaDictamenNom068"));
  assert.deepEqual(columnasDeApartado("estaciones-de-carburacion"), []);
  const encabezados = columnasDeApartado("auto-tanques").map((c) => c.encabezado);
  assert.equal(new Set(encabezados).size, encabezados.length, "encabezados repetidos");
});

function venc(clave: string, dias: number): Vencimiento {
  const fecha = new Date(Date.UTC(2026, 9, 27 + dias));
  return {
    clave, tipo: "ultrasonido", tipoNombre: "Ultrasonido", vehicleId: clave, numeroEconomico: clave,
    sectionSlug: "auto-tanques", sectionName: "Auto-Tanques", citySlug: "hermosillo", cityName: "Hermosillo",
    fecha, dias, nivel: dias <= 7 ? "red" : dias <= 30 ? "yellow" : "ok",
  };
}

test("aviso a rojo: solo lo nuevo, y vuelve a avisar si cambia la fecha", () => {
  const a = venc("A", 3);
  const b = venc("B", 20);
  assert.deepEqual(nuevosEnRojo([a, b], new Set()).map((v) => v.clave), ["A"]);
  assert.deepEqual(nuevosEnRojo([a], new Set([claveDeAviso(a)])), []);
  const aMovida = venc("A", 5);
  assert.deepEqual(nuevosEnRojo([aMovida], new Set([claveDeAviso(a)])).map((v) => v.clave), ["A"]);
});

test("correo: el título se puede cambiar y el texto se escapa", () => {
  const r = armarReporte([venc("<b>X</b>", 2)], { dias: 7, urlBase: null, titulo: "Pasaron a rojo" });
  assert.ok(r.html.includes("Pasaron a rojo"));
  assert.ok(!r.html.includes("<b>X</b>"));
  assert.equal(r.proximos, 1);
});
