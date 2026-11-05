import type { VehicleTechnicalSheet } from "@prisma/client";
import {
  ACOPLAMIENTO_DESCONEXION_SECA,
  VALVULAS_CARBURACION,
  VALVULAS_TANQUE_CARGA,
  VALVULA_MAXIMO_LLENADO_85,
} from "./ficha-campos";
import { DICTAMENES } from "./dictamen-alerts";

// Carga masiva de datos desde Excel (ver /ciudades/[citySlug]/carga-de-fechas;
// empezó solo con fechas, de ahí el nombre): qué columnas lleva la plantilla
// de cada apartado y cómo se leen los valores que regresan. Sin Prisma: se
// prueba con datos inventados. Los datos de texto están más abajo
// (columnasDeTextoDeApartado); la ciudad la resuelve carga-fechas-servidor.ts.
//
// Solo fechas de la ficha técnica que ya se editan a mano en el formulario
// (pruebas próximas, válvulas, manguera, conector, manómetro, acoplamiento y
// dictámenes). Las estaciones y la planta no entran: sus pruebas y válvulas
// van por tanque, en su propia ficha.

type CampoFecha = {
  [K in keyof VehicleTechnicalSheet]: VehicleTechnicalSheet[K] extends Date | null ? K : never;
}[keyof VehicleTechnicalSheet];

export type ColumnaFecha = { campo: CampoFecha; encabezado: string };

const PRUEBAS: ColumnaFecha[] = [
  { campo: "fechaProximoUltrasonido", encabezado: "Próximo ultrasonido" },
  { campo: "fechaProximaInspeccionVisual", encabezado: "Próxima inspección visual externa" },
  { campo: "fechaProximaPruebaHermeticidad", encabezado: "Próxima prueba de hermeticidad" },
  { campo: "fechaProximaInspeccionVisualInterna", encabezado: "Próxima inspección visual interna" },
  { campo: "fechaProximaPruebaHidrostatica", encabezado: "Próxima prueba hidrostática" },
];

const fab = (etiqueta: string) => `${etiqueta} — fabricación`;

// Reparto y utilitarias no tienen fechas en la plantilla, pero sí datos de
// texto (marca, placas, chofer...) y ciudad.
export const APARTADOS_CON_PLANTILLA = [
  "auto-tanques",
  "semirremolques",
  "vehiculo-con-tanque-de-carburacion",
  "tractocamiones",
  "vehiculo-de-reparto",
  "unidades-utilitarias",
] as const;

// ── Datos de texto ───────────────────────────────────────────────────────
// Además de fechas, la plantilla trae datos de texto: los generales de la
// unidad (VehicleRecord: marca, año, placas, observaciones) y los de la ficha
// técnica (Automóvil, Chofer y póliza, Tanque). Mismos límites que el
// formulario (actions/vehicle-actions.ts: vehicleSchema y technicalSheetSchema).

export type ColumnaTexto = {
  tabla: "unidad" | "ficha";
  campo: string;
  encabezado: string;
  max: number;
  // Obligatorio en el formulario: no se puede BORRAR.
  requerido?: boolean;
  // Dato del "Automóvil" que el formulario copia a la pareja Auto-Tanque /
  // carburación (AUTOMOVIL_SYNC_FIELDS en actions/vehicle-actions.ts).
  pareja?: boolean;
};

const DATOS_GENERALES: ColumnaTexto[] = [
  // En una unidad, la columna "sucursal" es la Marca (ver el schema).
  { tabla: "unidad", campo: "sucursal", encabezado: "Marca", max: 2000, requerido: true },
  { tabla: "unidad", campo: "anio", encabezado: "Año", max: 20, requerido: true },
  { tabla: "unidad", campo: "placas", encabezado: "Placas", max: 50, requerido: true },
  { tabla: "unidad", campo: "observaciones", encabezado: "Observaciones", max: 1000 },
];

const AUTOMOVIL: ColumnaTexto[] = [
  { tabla: "ficha", campo: "marca", encabezado: "Automóvil — Marca", max: 100, pareja: true },
  { tabla: "ficha", campo: "linea", encabezado: "Automóvil — Línea", max: 100, pareja: true },
  { tabla: "ficha", campo: "modelo", encabezado: "Automóvil — Modelo", max: 100, pareja: true },
  { tabla: "ficha", campo: "serie", encabezado: "Automóvil — Serie", max: 100, pareja: true },
  { tabla: "ficha", campo: "chofer", encabezado: "Chofer", max: 150, pareja: true },
  { tabla: "ficha", campo: "numeroPoliza", encabezado: "Número de póliza", max: 100, pareja: true },
  { tabla: "ficha", campo: "inciso", encabezado: "Inciso", max: 50, pareja: true },
];

const TANQUE: ColumnaTexto[] = [
  { tabla: "ficha", campo: "numeroSerieTanque", encabezado: "Tanque — número de serie", max: 100 },
  { tabla: "ficha", campo: "capacidadTanque", encabezado: "Tanque — capacidad (Lts)", max: 50 },
  { tabla: "ficha", campo: "marcaTanque", encabezado: "Tanque — marca", max: 100 },
  { tabla: "ficha", campo: "anioFabricacionTanque", encabezado: "Tanque — año de fabricación", max: 20 },
];

export function columnasDeTextoDeApartado(slug: string): ColumnaTexto[] {
  if (!(APARTADOS_CON_PLANTILLA as readonly string[]).includes(slug)) return [];
  // Igual que la ficha: reparto no lleva recuadro de tanque y el tractocamión
  // no tiene tanque.
  const conTanque = slug !== "vehiculo-de-reparto" && slug !== "tractocamiones";
  return [...DATOS_GENERALES, ...AUTOMOVIL, ...(conTanque ? TANQUE : [])];
}

export type ValorTexto = { tipo: "vacio" } | { tipo: "borrar" } | { tipo: "texto"; texto: string } | { tipo: "error"; texto: string };

// Celda de texto: vacía no cambia nada, BORRAR lo borra. Un número (Excel
// guarda "2018" o "500" como número) se toma como texto. Los espacios
// repetidos se juntan, como hace el formulario.
export function leerTexto(valor: unknown, columna: ColumnaTexto): ValorTexto {
  if (valor === null || valor === undefined) return { tipo: "vacio" };
  if (valor instanceof Date) return { tipo: "error", texto: "aquí va texto, no una fecha" };
  const texto = String(valor).replace(/\s+/g, " ").trim();
  if (!texto) return { tipo: "vacio" };
  if (texto.toUpperCase() === PALABRA_BORRAR) {
    return columna.requerido ? { tipo: "error", texto: "es obligatorio, no se puede borrar" } : { tipo: "borrar" };
  }
  if (texto.length > columna.max) return { tipo: "error", texto: `es demasiado largo (máximo ${columna.max} caracteres)` };
  return { tipo: "texto", texto };
}

// Para comparar nombres de ciudad sin que importen mayúsculas ni acentos
// ("Cd. Obregón" = "cd. obregon").
export function claveDeCiudad(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function columnasDeApartado(slug: string): ColumnaFecha[] {
  const dictamenes = DICTAMENES.filter((d) => d.apartados.includes(slug)).map((d) => ({
    campo: d.campo as CampoFecha,
    encabezado: `${d.nombre} — emisión`,
  }));
  if (slug === "auto-tanques" || slug === "semirremolques") {
    return [
      ...PRUEBAS,
      { campo: "fechaInstalacionValvulas", encabezado: "Instalación del juego de válvulas" },
      ...VALVULAS_TANQUE_CARGA.map((v) => ({ campo: v.fecha, encabezado: fab(v.etiqueta) })),
      { campo: VALVULA_MAXIMO_LLENADO_85.fecha, encabezado: fab(VALVULA_MAXIMO_LLENADO_85.etiqueta) },
      ...(slug === "auto-tanques"
        ? [
            { campo: "fechaFabricacionMangueraSurtir" as CampoFecha, encabezado: "Manguera de surtir — fabricación" },
            { campo: ACOPLAMIENTO_DESCONEXION_SECA.fecha, encabezado: fab(ACOPLAMIENTO_DESCONEXION_SECA.etiqueta) },
          ]
        : []),
      { campo: "fechaFabricacionConectorFlexible", encabezado: "Conector flexible — fabricación" },
      ...dictamenes,
    ];
  }
  if (slug === "vehiculo-con-tanque-de-carburacion") {
    return [
      ...PRUEBAS,
      { campo: "fechaInstalacionValvulas", encabezado: "Instalación del juego de válvulas" },
      ...VALVULAS_CARBURACION.map((v) => ({ campo: v.fecha, encabezado: fab(v.etiqueta) })),
      { campo: "fechaFabricacionManguera", encabezado: "Manguera de carburación — fabricación" },
      ...dictamenes,
    ];
  }
  if (slug === "tractocamiones") return dictamenes;
  return [];
}

// Escribir esto en una celda borra la fecha guardada. Una celda vacía NO
// borra nada: así una plantilla incompleta nunca deja fechas en blanco.
export const PALABRA_BORRAR = "BORRAR";

export type ValorLeido = { tipo: "vacio" } | { tipo: "borrar" } | { tipo: "fecha"; fecha: Date } | { tipo: "error"; texto: string };

function utc(a: number, m: number, d: number): Date | null {
  if (a < 1950 || a > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const f = new Date(Date.UTC(a, m - 1, d));
  return f.getUTCMonth() === m - 1 ? f : null; // descarta 31/02
}

// Lo que puede venir en una celda: fecha de Excel (número de serie o Date),
// "dd/mm/aaaa", "aaaa-mm-dd", vacío o BORRAR. Las fechas se guardan a
// medianoche UTC, como en el resto del sistema.
export function leerFecha(valor: unknown): ValorLeido {
  if (valor === null || valor === undefined) return { tipo: "vacio" };
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return { tipo: "error", texto: "fecha inválida" };
    // La librería de Excel entrega la medianoche local, y en fechas viejas a
    // veces unos segundos antes (23:59:59 del día anterior). Sumar 12 h y
    // tomar el día de calendario local cubre los dos casos.
    const centro = new Date(valor.getTime() + 12 * 60 * 60 * 1000);
    const f = utc(centro.getFullYear(), centro.getMonth() + 1, centro.getDate());
    return f ? { tipo: "fecha", fecha: f } : { tipo: "error", texto: "fecha fuera de rango" };
  }
  if (typeof valor === "number") {
    // Número de serie de Excel (días desde 1899-12-30).
    const base = Date.UTC(1899, 11, 30);
    const d = new Date(base + Math.round(valor) * 86_400_000);
    const f = utc(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    return f ? { tipo: "fecha", fecha: f } : { tipo: "error", texto: `«${valor}» no es una fecha` };
  }
  const texto = String(valor).trim();
  if (!texto) return { tipo: "vacio" };
  if (texto.toUpperCase() === PALABRA_BORRAR) return { tipo: "borrar" };
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texto);
  if (m) {
    const f = utc(Number(m[3]), Number(m[2]), Number(m[1]));
    return f ? { tipo: "fecha", fecha: f } : { tipo: "error", texto: `«${texto}» no es una fecha válida (dd/mm/aaaa)` };
  }
  m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(texto);
  if (m) {
    const f = utc(Number(m[1]), Number(m[2]), Number(m[3]));
    return f ? { tipo: "fecha", fecha: f } : { tipo: "error", texto: `«${texto}» no es una fecha válida` };
  }
  return { tipo: "error", texto: `«${texto}» no es una fecha (usa dd/mm/aaaa)` };
}

export function textoFecha(fecha: Date | null | undefined): string {
  if (!fecha) return "";
  const d = (n: number) => String(n).padStart(2, "0");
  return `${d(fecha.getUTCDate())}/${d(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()}`;
}

// Un cambio de la vista previa. Según el tipo, antes/después son:
// fecha → ISO o null; texto → el texto o null (borrar); ciudad → nombre de la
// ciudad (en "ciudad", campo lleva el id de la ciudad destino).
export type CambioCarga = {
  vehicleId: string;
  numeroEconomico: string;
  apartado: string;
  tipo: "fecha" | "texto" | "ciudad";
  campo: string;
  etiqueta: string;
  antes: string | null;
  despues: string | null;
  // Aclaración para la vista previa (p. ej. "se copia de su pareja").
  nota?: string;
};

export type ProblemaCarga = { hoja: string; fila: number; mensaje: string };
