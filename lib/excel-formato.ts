import * as XLSX from "xlsx-js-style";
import { buildZip, readZip } from "./zip";

// Formato de las hojas de Excel que descarga el sistema, copiado del Excel
// de flotilla que el equipo armó a mano ("Flotilla Pagasa - Unidades_1.xlsx"):
//
// - Encabezado con un color por grupo de columnas (datos generales, ficha
//   técnica, tanque, válvulas, manguera, pruebas, baja), letra blanca en
//   negritas Calibri 10, centrado y con ajuste de texto.
// - Filas en Calibri 10, alternando blanco y azul muy claro, con bordes gris
//   claro, para no perder el renglón al recorrer hacia la derecha.
// - El nombre (Ciudad + Número económico, o Nombre en estaciones) de una
//   unidad dada de baja, en naranja: así lo marcó el equipo en su Excel.
// - Encabezado y columnas de identificación (Ciudad, Número económico o
//   Nombre) inmovilizados, igual que el Excel del equipo (que fija hasta la
//   columna B): al recorrer hacia la derecha siempre se ve de qué unidad es
//   la fila. xlsx-js-style no sabe escribir paneles inmovilizados, así que
//   se agregan al final con escribirLibro().
// - Filtro en el encabezado y anchos según el contenido, para navegar más
//   fácil (el Excel del equipo no los tenía, pero no cambian lo de arriba).

// Colores tomados tal cual del Excel del equipo (xl/styles.xml).
const COLOR = {
  general: "1F3864",
  ficha: "2F5597",
  tanque: "375623",
  valvulas: "8E4B10",
  mangueras: "5B3A29",
  pruebas: "5F2B7A",
  baja: "595959",
  zebra: "F4F7FB",
  borde: "D9D9D9",
  dadaDeBaja: "FAC090",
};

type Grupo = keyof Pick<typeof COLOR, "general" | "ficha" | "tanque" | "valvulas" | "mangueras" | "pruebas" | "baja">;

// A qué grupo pertenece cada columna, por su encabezado. Sigue el mismo
// acomodo de colores que el Excel del equipo.
export function grupoDeColumna(encabezado: string): Grupo {
  const h = encabezado.toLowerCase();
  if (h.startsWith("fecha de baja") || h.startsWith("motivo de baja") || h.includes("gobernador")) return "baja";
  if (h.startsWith("válvula") || h.startsWith("válvulas") || h.startsWith("¿tiene válvula")) return "valvulas";
  // Llevan el mismo plazo que las válvulas y entran a su misma alerta.
  if (h.startsWith("manómetro") || h.startsWith("acoplamiento")) return "valvulas";
  if (h.startsWith("manguera") || h.startsWith("conector flexible")) return "mangueras";
  if (h.startsWith("tanque") || h.startsWith("placa —")) return "tanque";
  if (
    /^(visual externa|hermeticidad|visual interna|ultrasonido|hidrostática|último|última|próximo|próxima|extintor|mant\. preventivo|cumplimiento|cumple|póliza —)/.test(h)
  )
    return "pruebas";
  if (
    /^(ciudad|número económico|nombre|estado|estatus|calidad de la unidad|marca \(datos generales\)|año|placas|observaciones|permisionaria|permiso|dirección|conjunto|viaja con|tipo|unidad)/.test(h)
  )
    return "general";
  return "ficha";
}

const borde = { style: "thin", color: { rgb: COLOR.borde } };
const bordes = { top: borde, bottom: borde, left: borde, right: borde };

function estiloEncabezado(grupo: Grupo) {
  return {
    font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
    fill: { patternType: "solid", fgColor: { rgb: COLOR[grupo] } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: bordes,
  };
}

function estiloCelda(relleno: string | null) {
  return {
    font: { name: "Calibri", sz: 10 },
    ...(relleno ? { fill: { patternType: "solid", fgColor: { rgb: relleno } } } : {}),
    alignment: { horizontal: "left", vertical: "center" },
    border: bordes,
  };
}

// Columnas que forman "el nombre" de la fila y se pintan de naranja cuando
// está dada de baja.
const COLUMNAS_NOMBRE = new Set(["Ciudad", "Número económico", "Nombre"]);

// Columnas de identificación que se quedan fijas al deslizar hacia la
// derecha ("Conjunto" es la de la hoja de conjuntos de Transportadora Kino).
// Solo cuentan las que están pegadas al inicio, en orden.
const COLUMNAS_FIJAS = new Set([...COLUMNAS_NOMBRE, "Conjunto"]);

export function columnasFijas(encabezados: string[]): number {
  let n = 0;
  while (n < encabezados.length && COLUMNAS_FIJAS.has(encabezados[n])) n++;
  return n;
}

export function hojaConFormato(filas: Record<string, string>[], encabezados: string[]): XLSX.WorkSheet {
  const datos = [encabezados, ...filas.map((f) => encabezados.map((h) => f[h] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(datos);
  const iEstado = encabezados.indexOf("Estado");

  for (let c = 0; c < encabezados.length; c++) {
    const ref = XLSX.utils.encode_cell({ r: 0, c });
    ws[ref].s = estiloEncabezado(grupoDeColumna(encabezados[c]));
  }
  for (let r = 1; r < datos.length; r++) {
    const dadaDeBaja = iEstado >= 0 && datos[r][iEstado] === "Dado de baja";
    const zebra = r % 2 === 1 ? null : COLOR.zebra;
    for (let c = 0; c < encabezados.length; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      // Una celda vacía no existe en la hoja: se crea para que lleve borde
      // y color igual que las demás.
      if (!ws[ref]) ws[ref] = { t: "s", v: "" };
      const naranja = dadaDeBaja && COLUMNAS_NOMBRE.has(encabezados[c]);
      ws[ref].s = estiloCelda(naranja ? COLOR.dadaDeBaja : zebra);
    }
  }

  // Anchos según el contenido (entre 10 y 40 caracteres), con el encabezado
  // partido en renglones.
  ws["!cols"] = encabezados.map((h, c) => {
    let max = Math.min(18, Math.max(10, Math.ceil(h.length / 3)));
    for (let r = 1; r < datos.length; r++) max = Math.max(max, String(datos[r][c] ?? "").length + 2);
    return { wch: Math.min(40, max) };
  });
  ws["!rows"] = [{ hpt: 64 }];
  if (encabezados.length > 0) {
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, datos.length - 1), c: encabezados.length - 1 } }) };
  }
  // Lo lee escribirLibro(); el escritor de xlsx ignora las claves con "!".
  ws["!inmovilizar"] = { columnas: columnasFijas(encabezados) };
  return ws;
}

// <sheetView> con el panel inmovilizado: la fila 1 (encabezado) siempre, y
// las primeras `columnas` columnas si hay.
function vistaInmovilizada(columnas: number): string {
  if (columnas <= 0) {
    return '<sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView>';
  }
  const primeraLibre = XLSX.utils.encode_col(columnas); // columna donde empieza lo que se desliza
  return (
    `<sheetView workbookViewId="0"><pane xSplit="${columnas}" ySplit="1" topLeftCell="${primeraLibre}2" activePane="bottomRight" state="frozen"/>` +
    `<selection pane="topRight" activeCell="${primeraLibre}1" sqref="${primeraLibre}1"/>` +
    '<selection pane="bottomLeft" activeCell="A2" sqref="A2"/>' +
    `<selection pane="bottomRight" activeCell="${primeraLibre}2" sqref="${primeraLibre}2"/></sheetView>`
  );
}

// Escribe el libro como .xlsx y le agrega a cada hoja hecha con
// hojaConFormato el encabezado y las columnas de identificación
// inmovilizados. Las hojas se escriben como xl/worksheets/sheet1.xml,
// sheet2.xml... en el orden de workbook.SheetNames.
export function escribirLibro(workbook: XLSX.WorkBook): Buffer {
  const crudo = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const archivos = readZip(crudo);
  workbook.SheetNames.forEach((nombre, i) => {
    const marca = workbook.Sheets[nombre]?.["!inmovilizar"] as { columnas: number } | undefined;
    if (!marca) return;
    const archivo = archivos.find((a) => a.name === `xl/worksheets/sheet${i + 1}.xml`);
    if (!archivo) return;
    const xml = archivo.data.toString("utf8");
    const vacia = '<sheetView workbookViewId="0"/>';
    // Si la librería cambiara su XML no se pierde la descarga: la hoja sale
    // igual que antes, solo que sin inmovilizar.
    if (!xml.includes(vacia)) return;
    archivo.data = Buffer.from(xml.replace(vacia, vistaInmovilizada(marca.columnas)), "utf8");
  });
  return buildZip(archivos);
}

export { XLSX };
