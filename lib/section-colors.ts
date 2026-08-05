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
} as const;

export type SectionColorKey = keyof typeof SECTION_STYLES;
