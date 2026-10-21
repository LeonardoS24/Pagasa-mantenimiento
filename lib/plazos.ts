// Plazos normativos en años que usan las alertas de vencimiento. Los valores
// base son los del catálogo (ver lib/requisitos-normativos.ts) y el ADMIN los
// puede cambiar desde /admin/normas; lo cambiado se guarda en la base y se
// carga con lib/requisitos-runtime.ts.
//
// Este archivo no importa Prisma a propósito: lo usan también los componentes
// de navegador (las fichas con formulario calculan su propio aviso), y un
// archivo con Prisma no puede ir al navegador.
//
// Por qué un registro global en vez de pasar los plazos a cada función: las
// funciones de alerta (getValveAlertLevel, getHoseVencimiento...) se llaman
// desde ~20 lugares, servidor y navegador. El plazo es una sola configuración
// para todo el sistema (no cambia por petición), y el proceso del servidor es
// uno solo. Se guarda en globalThis, no en una variable del módulo, porque
// Next.js empaqueta el mismo archivo varias veces (páginas, rutas de API) y
// una variable de módulo no se compartiría entre ellas. En el navegador, las
// fichas que lo necesitan reciben `plazos` por props y lo fijan al pintarse.
export type Plazos = {
  valvulasTanqueCarga: number; // Auto-Tanques y Semirremolques
  valvulasCarburacion: number; // Vehículo con tanque de carburación
  valvulasEstacion: number; // Estaciones de carburación
  instrumentosPlanta: number; // Instrumentos del tanque de la Planta
  mangueraTrasiego: number; // manguera de surtir del tanque de carga
  mangueraCarburacion: number; // manguera de alta presión de carburación
};

export const PLAZOS_BASE: Plazos = {
  valvulasTanqueCarga: 10,
  valvulasCarburacion: 5,
  valvulasEstacion: 5,
  instrumentosPlanta: 5,
  mangueraTrasiego: 5,
  mangueraCarburacion: 2,
};

// Plazo de las válvulas de una unidad que no es de ningún grupo de arriba
// (utilitarias, tractocamiones...): nunca se edita.
export const ANIOS_VALVULAS_OTRAS_UNIDADES = 5;

const CLAVE_GLOBAL = "__pagasaPlazos";

export function plazosActivos(): Plazos {
  return ((globalThis as Record<string, unknown>)[CLAVE_GLOBAL] as Plazos | undefined) ?? PLAZOS_BASE;
}

export function fijarPlazos(plazos: Plazos): void {
  (globalThis as Record<string, unknown>)[CLAVE_GLOBAL] = plazos;
}
