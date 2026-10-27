import type { VehicleTechnicalSheet } from "@prisma/client";
import {
  ACOPLAMIENTO_DESCONEXION_SECA,
  VALVULAS_CARBURACION,
  VALVULAS_TANQUE_CARGA,
  VALVULA_MAXIMO_LLENADO_85,
} from "./ficha-campos";
import { DICTAMENES } from "./dictamen-alerts";

// Carga masiva de fechas desde Excel (ver /ciudades/[citySlug]/carga-de-fechas):
// qué columnas lleva la plantilla de cada apartado y cómo se leen las fechas
// que regresan. Sin Prisma: se prueba con datos inventados.
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

export const APARTADOS_CON_PLANTILLA = [
  "auto-tanques",
  "semirremolques",
  "vehiculo-con-tanque-de-carburacion",
  "tractocamiones",
] as const;

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

export type CambioFecha = {
  vehicleId: string;
  numeroEconomico: string;
  apartado: string;
  campo: string;
  etiqueta: string;
  antes: string | null; // ISO o null
  despues: string | null; // ISO o null (borrar)
};

export type ProblemaCarga = { hoja: string; fila: number; mensaje: string };
