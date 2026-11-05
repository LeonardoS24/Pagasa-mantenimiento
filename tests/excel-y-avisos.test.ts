// Lectura de la plantilla de fechas, aviso de lo que pasa a rojo y el correo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { claveDeCiudad, columnasDeApartado, columnasDeTextoDeApartado, leerFecha, leerTexto, textoFecha } from "../lib/carga-fechas";
import { claveDeAviso, nuevosEnRojo } from "../lib/aviso-rojo";
import { armarReporte } from "../lib/reporte-vencimientos";
import type { Vencimiento } from "../lib/vencimientos";
import { citaPara } from "../lib/expediente";

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

test("plantilla: datos de texto según el tipo de unidad", () => {
  const campos = (slug: string) => columnasDeTextoDeApartado(slug).map((c) => c.campo);
  assert.ok(campos("auto-tanques").includes("sucursal") && campos("auto-tanques").includes("marcaTanque"));
  // Reparto no lleva recuadro de tanque; el tractocamión no tiene tanque.
  assert.ok(campos("vehiculo-de-reparto").includes("placas") && !campos("vehiculo-de-reparto").includes("marcaTanque"));
  assert.ok(!campos("tractocamiones").includes("capacidadTanque"));
  assert.deepEqual(columnasDeTextoDeApartado("estaciones-de-carburacion"), []);
  // Ningún encabezado de texto choca con uno de fecha en la misma hoja.
  for (const slug of ["auto-tanques", "semirremolques", "vehiculo-con-tanque-de-carburacion", "tractocamiones"]) {
    const todos = [...columnasDeTextoDeApartado(slug), ...columnasDeApartado(slug)].map((c) => c.encabezado);
    assert.equal(new Set(todos).size, todos.length, `encabezados repetidos en ${slug}`);
  }
});

test("plantilla: lee texto, número, BORRAR y respeta obligatorios y largo", () => {
  const [marca] = columnasDeTextoDeApartado("auto-tanques"); // sucursal = Marca, obligatoria
  const obs = columnasDeTextoDeApartado("auto-tanques").find((c) => c.campo === "observaciones")!;
  const anio = columnasDeTextoDeApartado("auto-tanques").find((c) => c.campo === "anio")!;
  assert.deepEqual(leerTexto("  International   4400 ", marca), { tipo: "texto", texto: "International 4400" });
  assert.deepEqual(leerTexto(2018, anio), { tipo: "texto", texto: "2018" });
  assert.equal(leerTexto("", obs).tipo, "vacio");
  assert.equal(leerTexto(null, obs).tipo, "vacio");
  assert.equal(leerTexto("borrar", obs).tipo, "borrar");
  assert.equal(leerTexto("BORRAR", marca).tipo, "error");
  assert.equal(leerTexto("x".repeat(21), anio).tipo, "error");
  assert.equal(leerTexto(new Date(), obs).tipo, "error");
  assert.equal(claveDeCiudad("  Cd.  Obregón "), claveDeCiudad("cd. obregon"));
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

test("expediente: cada unidad cita solo la norma que le aplica", () => {
  const norma = "NOM-EM-009-ASEA-2026 (Auto-Tanques) y NOM-EM-008-ASEA-2026 (Semirremolques)";
  const numeral = "7.2.2.4, Tabla 3 (Auto-Tanques) · 7.4.4, Tabla 2 (Semirremolques)";
  assert.equal(citaPara(norma, numeral, "auto-tanques"), "NOM-EM-009-ASEA-2026, 7.2.2.4, Tabla 3");
  assert.equal(citaPara(norma, numeral, "semirremolques"), "NOM-EM-008-ASEA-2026, 7.4.4, Tabla 2");
  assert.equal(citaPara("NOM-005-SESH-2010", "9.6.4", "vehiculo-con-tanque-de-carburacion"), "NOM-005-SESH-2010, 9.6.4");
});

test("visto bueno: deja de valer si el registro se edita después", async () => {
  const { modificadoDespues } = await import("../lib/visto-bueno-tipos");
  const vb = { userId: "u", username: "sup", fecha: "2026-11-02T10:00:00Z", comentario: null, registroActualizadoEl: "2026-11-02T09:00:00Z" };
  assert.equal(modificadoDespues(vb, "2026-11-02T09:00:00.500Z"), false);
  assert.equal(modificadoDespues(vb, new Date("2026-11-02T11:00:00Z")), true);
  assert.equal(modificadoDespues({ ...vb, registroActualizadoEl: null }, new Date()), false);
});
