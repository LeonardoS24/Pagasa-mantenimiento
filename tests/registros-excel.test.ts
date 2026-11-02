// Lectura y validación del Excel de registros nuevos de bitácora (lib/registros-excel.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { COL_UNIDAD, HOJA_DE_TIPO, encabezadosDeTipo, leerHojaRegistros, tipoDeHoja, type UnidadResuelta } from "../lib/registros-excel";
import { TIPOS_EN_LOTE } from "../lib/registro-lote";

const AT: UnidadResuelta = { id: "u1", nombre: "KG-158", slug: "auto-tanques" };
const REP: UnidadResuelta = { id: "u2", nombre: "PH 92", slug: "vehiculo-de-reparto" };
const EST: UnidadResuelta = { id: "u3", nombre: "Pitic", slug: "estaciones-de-carburacion" };
const unidades = new Map<string, UnidadResuelta>([
  ["kg-158 · auto-tanques · hermosillo", AT],
  ["ph 92 · vehiculo de reparto · hermosillo", REP],
  ["pitic · estaciones de carburacion · hermosillo", EST],
]);
const resolver = (texto: string) => unidades.get(texto.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")) ?? null;

test("excel de registros: cada hoja es un tipo y se reconoce sin importar acentos ni mayúsculas", () => {
  assert.equal(tipoDeHoja("Hidrostática"), "HIDROSTATICA");
  assert.equal(tipoDeHoja("hidrostatica"), "HIDROSTATICA");
  assert.equal(tipoDeHoja("Póliza"), "POLIZA");
  assert.equal(tipoDeHoja("Instrucciones"), null);
  // Hay una hoja para cada tipo en lote y los nombres no pasan de 31 caracteres (límite de Excel).
  for (const t of TIPOS_EN_LOTE) assert.ok((HOJA_DE_TIPO[t] ?? "").length > 0 && HOJA_DE_TIPO[t]!.length <= 31);
});

test("excel de registros: la plantilla pide la unidad y los mismos campos de la bitácora", () => {
  const e = encabezadosDeTipo("EXTINTOR");
  assert.equal(e[0], COL_UNIDAD);
  assert.deepEqual(e.slice(1), ["Responsable", "Fecha de instalación", "Fecha de vencimiento", "Calidad del extintor"]);
});

const ENC_EXTINTOR = ["Unidad", "Responsable", "Fecha de instalación", "Fecha de vencimiento", "Calidad del extintor"];

test("extintor: lee fechas de texto y de Excel, la calidad por su nombre, y omite renglones sin datos", () => {
  const celdas = [
    ENC_EXTINTOR,
    ["KG-158 · Auto-Tanques · Hermosillo", "Manuel", "05/03/2026", new Date(2027, 2, 5), "buena"],
    ["PH 92 · Vehículo de reparto · Hermosillo", null, null, null, null], // plantilla sin llenar
    ["PH 92 · Vehículo de reparto · Hermosillo", "", 46086, "2027-03-05", "Excelente"],
  ];
  const r = leerHojaRegistros("EXTINTOR", "Extintor", celdas, resolver);
  assert.deepEqual(r.problemas, []);
  assert.equal(r.filas.length, 2);
  assert.deepEqual(r.filas[0].valores, { responsable: "Manuel", fechaRealizacion: "2026-03-05", fechaVencimiento: "2027-03-05", calidad: "BUENA" });
  assert.equal(r.filas[0].vehicleId, "u1");
  assert.equal(r.filas[0].fila, 2);
  assert.equal(r.filas[1].valores.fechaRealizacion, "2026-03-05"); // 46086 = 05/03/2026 en Excel
  assert.equal(r.filas[1].valores.calidad, "EXCELENTE");
  assert.equal(r.filas[1].fila, 4);
});

test("extintor: señala unidad inexistente, fechas mal escritas, calidad inválida y obligatorios que faltan", () => {
  const celdas = [
    ENC_EXTINTOR,
    ["KG-999 · Auto-Tanques · Hermosillo", null, "05/03/2026", "05/03/2027", "Buena"],
    ["KG-158 · Auto-Tanques · Hermosillo", null, "31/02/2026", "05/03/2027", "Buena"],
    ["KG-158 · Auto-Tanques · Hermosillo", null, "05/03/2026", "05/03/2027", "Regular"],
    ["KG-158 · Auto-Tanques · Hermosillo", null, "05/03/2026", null, "Buena"],
    [null, null, "05/03/2026", "05/03/2027", "Buena"],
  ];
  const r = leerHojaRegistros("EXTINTOR", "Extintor", celdas, resolver);
  assert.equal(r.filas.length, 0);
  assert.equal(r.problemas.length, 5);
  assert.ok(r.problemas[0].mensaje.includes("no existe"));
  assert.ok(r.problemas[1].mensaje.includes("fecha"));
  assert.ok(r.problemas[2].mensaje.includes("opción válida"));
  assert.ok(r.problemas[3].mensaje.includes("falta"));
  assert.ok(r.problemas[4].mensaje.includes("no dice la unidad"));
  assert.deepEqual(r.problemas.map((p) => p.fila), [2, 3, 4, 5, 6]);
});

test("excel de registros: no se registra en lote donde no aplica y se avisa del renglón repetido", () => {
  const celdas = [
    ["Unidad", "Responsable", "Fecha de instalación", "Fecha de fabricación de la manguera"],
    ["KG-158 · Auto-Tanques · Hermosillo", null, "05/03/2026", "01/01/2026"], // mangueras solo en carburación
  ];
  assert.ok(leerHojaRegistros("MANGUERAS", "Mangueras", celdas, resolver).problemas[0].mensaje.includes("no se le registra"));

  const hidro = [
    ["Unidad", "Compañía", "Número de prueba", "Responsable", "Fecha de la última prueba", "Fecha de realización"],
    ["Pitic · Estaciones de carburación · Hermosillo", null, null, null, null, "05/03/2026"], // pruebas de tanque de estación van por tanque
  ];
  assert.ok(leerHojaRegistros("HIDROSTATICA", "Hidrostática", hidro, resolver).problemas[0].mensaje.includes("no se le registra"));

  const dos = [ENC_EXTINTOR, ["KG-158 · Auto-Tanques · Hermosillo", null, "05/03/2026", "05/03/2027", "Buena"], ["KG-158 · Auto-Tanques · Hermosillo", null, "05/03/2026", "05/03/2027", "Buena"]];
  const r = leerHojaRegistros("EXTINTOR", "Extintor", dos, resolver);
  assert.equal(r.filas.length, 1);
  assert.ok(r.problemas[0].mensaje.includes("repetido"));
});

test("excel de registros: sin la columna Unidad o sin columnas obligatorias avisa y no inventa nada", () => {
  assert.ok(leerHojaRegistros("EXTINTOR", "Extintor", [["Responsable"], ["x"]], resolver).problemas[0].mensaje.includes("Unidad"));
  const sinFecha = leerHojaRegistros("EXTINTOR", "Extintor", [["Unidad", "Responsable"], ["KG-158 · Auto-Tanques · Hermosillo", "x"]], resolver);
  assert.equal(sinFecha.filas.length, 0);
  assert.ok(sinFecha.problemas[0].mensaje.includes("obligatorias"));
});

test("mantenimiento: kilometraje como número y estatus por su nombre", () => {
  const enc = ["Unidad", "Tipo de mantenimiento", "Tipo de servicio", "Calidad de la unidad", "Fecha", "Kilometraje", "Responsable del trabajo", "Estatus", "Descripción", "Observación"];
  const celdas = [enc, ["PH 92 · Vehículo de reparto · Hermosillo", "Preventivo", "Afinación", "Buena", "05/03/2026", "152,300", "Juan", "Terminado", null, null]];
  const r = leerHojaRegistros("MANTENIMIENTO", "Mantenimiento", celdas, resolver);
  assert.deepEqual(r.problemas, []);
  assert.deepEqual(r.filas[0].valores, {
    tipoMantenimiento: "Preventivo",
    tipoServicio: "Afinación",
    calidad: "BUENA",
    fechaRealizacion: "2026-03-05",
    kilometraje: "152300",
    responsable: "Juan",
    estatus: "TERMINADO",
  });
  // Una opción que el sistema no tiene se avisa en vez de adivinar.
  celdas[1][1] = "Mensual";
  assert.ok(leerHojaRegistros("MANTENIMIENTO", "Mantenimiento", celdas, resolver).problemas[0].mensaje.includes("opción válida"));
});

test("excel de registros: el número de ultrasonido es obligatorio y no se repite entre unidades", () => {
  const otra: UnidadResuelta = { id: "u9", nombre: "KG-159", slug: "auto-tanques" };
  const res = (t: string) => (t.trim().toLowerCase().startsWith("kg-159") ? otra : resolver(t));
  const enc = ["Unidad", "Compañía", "Número de ultrasonido", "Responsable", "Última fecha de ultrasonido", "Fecha de realización"];
  const sinNumero = leerHojaRegistros("ULTRASONIDO", "Ultrasonido", [enc, ["KG-158 · Auto-Tanques · Hermosillo", null, null, null, null, "05/03/2026"]], res);
  assert.equal(sinNumero.filas.length, 0);
  assert.ok(sinNumero.problemas[0].mensaje.includes("Número de ultrasonido"));

  const dos = leerHojaRegistros(
    "ULTRASONIDO",
    "Ultrasonido",
    [
      enc,
      ["KG-158 · Auto-Tanques · Hermosillo", null, "US-12", null, null, "05/03/2026"],
      ["KG-159 · Auto-Tanques · Hermosillo", null, "us 12", null, null, "05/03/2026"],
    ],
    res
  );
  assert.equal(dos.filas.length, 1);
  assert.ok(dos.problemas[0].mensaje.includes("Cada unidad lleva el suyo"));
});
