// Transportadora Kino (ver scripts/crear-transportadora-kino.mts) es una
// "ciudad" más del sistema, pero su flota no es de reparto: son
// tractocamiones que jalan semirremolques tipo tanque de gas L.P. Por eso su
// "Unidad de distribución" no trae los 4 sub-apartados de siempre sino estos
// dos, y el comportamiento de cada página se decide por estos slugs (igual
// que el resto de los apartados, ver CLAUDE.md).
export const TRACTOCAMIONES_SLUG = "tractocamiones";
export const SEMIRREMOLQUES_SLUG = "semirremolques";

// Un "full" lleva el tractocamión y hasta dos semirremolques acoplados con
// dolly; así vienen todos los dictámenes (ver ConjuntoTransporte).
export const MAX_SEMIRREMOLQUES_POR_CONJUNTO = 2;

export function esApartadoKino(sectionSlug: string): boolean {
  return sectionSlug === TRACTOCAMIONES_SLUG || sectionSlug === SEMIRREMOLQUES_SLUG;
}

// Tanque de carga: un Auto-Tanque y un Semirremolque llevan el mismo tipo
// de recipiente (con su placa metálica), el mismo juego de válvulas y las
// mismas 5 pruebas periódicas. La única diferencia es que el semirremolque
// no tiene motor propio — eso lo lleva el tractocamión.
export function esTanqueDeCarga(sectionSlug: string): boolean {
  return sectionSlug === "auto-tanques" || sectionSlug === SEMIRREMOLQUES_SLUG;
}

export function esTractocamion(sectionSlug: string): boolean {
  return sectionSlug === TRACTOCAMIONES_SLUG;
}

export function esSemirremolque(sectionSlug: string): boolean {
  return sectionSlug === SEMIRREMOLQUES_SLUG;
}
