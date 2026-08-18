// Texto del enlace "Ver X →" en paneles de alertas y listas que mezclan
// varios tipos de VehicleRecord (unidades normales, Estaciones de
// carburación y Planta comparten VehicleTechnicalSheet, así que un mismo
// panel de alertas puede traer renglones de los tres). Antes todos decían
// "Ver unidad" sin importar de qué se tratara.
export function verRecordLabel(sectionSlug: string): string {
  if (sectionSlug === "estaciones-de-carburacion") return "Ver estación";
  if (sectionSlug === "planta-ficha-tecnica") return "Ver planta";
  return "Ver unidad";
}

// Mismo criterio para un Equipo (que no es un VehicleRecord, pero puede
// aparecer en listas mixtas en el futuro).
export const VER_EQUIPO_LABEL = "Ver equipo";

// Mismo criterio que verRecordLabel, para los textos de "dar de baja" y
// "eliminar" de la página de detalle (antes siempre decían "unidad" sin
// importar si era una estación o una planta).
export type TipoRegistro = "estacion" | "planta" | "unidad";

export function tipoRegistro(sectionSlug: string): TipoRegistro {
  if (sectionSlug === "estaciones-de-carburacion") return "estacion";
  if (sectionSlug === "planta-ficha-tecnica") return "planta";
  return "unidad";
}

export function tipoRegistroLabel(sectionSlug: string): string {
  const tipo = tipoRegistro(sectionSlug);
  return tipo === "estacion" ? "estación" : tipo === "planta" ? "planta" : "unidad";
}
