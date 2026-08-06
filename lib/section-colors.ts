// Un solo color por tipo de sección, compartido entre la ficha técnica
// (TechnicalSheetForm/TechnicalSheetView) y las tarjetas de registro/bitácora
// de la página de la unidad, para que "Prueba de Hermeticidad" se vea del
// mismo color en ambos lugares.
export const SECTION_STYLES = {
  automovil: "border-l-4 border-l-slate-400 bg-slate-50/60",
  extintor: "border-l-4 border-l-red-400 bg-red-50/60",
  mantenimiento: "border-l-4 border-l-emerald-400 bg-emerald-50/60",
  tanque: "border-l-4 border-l-sky-400 bg-sky-50/60",
  mangueras: "border-l-4 border-l-amber-400 bg-amber-50/60",
  valvulas: "border-l-4 border-l-indigo-400 bg-indigo-50/60",
  ultrasonido: "border-l-4 border-l-cyan-400 bg-cyan-50/60",
  visualExterna: "border-l-4 border-l-purple-400 bg-purple-50/60",
  hermeticidad: "border-l-4 border-l-fuchsia-400 bg-fuchsia-50/60",
  visualInterna: "border-l-4 border-l-violet-400 bg-violet-50/60",
  hidrostatica: "border-l-4 border-l-blue-400 bg-blue-50/60",
  // Las 3 divisiones de color del apartado "Equipos" (ver lib/equipo-enums.ts).
  equipoMecanico: "border-l-4 border-l-teal-400 bg-teal-50/60",
  equipoElectrico: "border-l-4 border-l-yellow-400 bg-yellow-50/60",
  equipoAuxiliar: "border-l-4 border-l-rose-400 bg-rose-50/60",
} as const;

export type SectionColorKey = keyof typeof SECTION_STYLES;

// Mismos colores que SECTION_STYLES, en versión "badge" (para la bitácora de
// unidades a nivel ciudad, donde cada evento lleva una etiqueta chica en vez
// de un panel completo). "baja" no tiene equivalente en SECTION_STYLES: usa
// el mismo naranja que el badge "Dado de baja" de VehicleTable.
export const BADGE_STYLES = {
  automovil: "bg-slate-100 text-slate-700",
  extintor: "bg-red-100 text-red-700",
  mantenimiento: "bg-emerald-100 text-emerald-700",
  tanque: "bg-sky-100 text-sky-700",
  mangueras: "bg-amber-100 text-amber-700",
  valvulas: "bg-indigo-100 text-indigo-700",
  ultrasonido: "bg-cyan-100 text-cyan-700",
  visualExterna: "bg-purple-100 text-purple-700",
  hermeticidad: "bg-fuchsia-100 text-fuchsia-700",
  visualInterna: "bg-violet-100 text-violet-700",
  hidrostatica: "bg-blue-100 text-blue-700",
  baja: "border border-orange-400 bg-orange-100 text-orange-800",
  equipoMecanico: "bg-teal-100 text-teal-700",
  equipoElectrico: "bg-yellow-100 text-yellow-800",
  equipoAuxiliar: "bg-rose-100 text-rose-700",
} as const;

export type BadgeColorKey = keyof typeof BADGE_STYLES;

// tipoEquipo ("MECANICO"|"ELECTRICO"|"AUXILIAR") -> llave de color, para no
// repetir este mapeo en cada componente que colorea por tipo de equipo. El
// tipo de retorno es válido tanto en SECTION_STYLES como en BADGE_STYLES: las
// 3 llaves de equipo existen en ambos mapas.
export function equipoColorKey(
  tipoEquipo: string
): "equipoMecanico" | "equipoElectrico" | "equipoAuxiliar" {
  if (tipoEquipo === "MECANICO") return "equipoMecanico";
  if (tipoEquipo === "ELECTRICO") return "equipoElectrico";
  return "equipoAuxiliar";
}
