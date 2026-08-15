// Slugs de los dos apartados que se comportan como una Estación de
// carburación (ver components/admin/VehicleForm.tsx: isEstacion). Usado para
// acotar la Bitácora de estaciones (ver isBitacoraEstacionesFeed en el
// catch-all de ciudad/apartado) a solo estos registros, sin tocar el resto
// de unidades de la ciudad.
export const ESTACION_LIKE_SECTION_SLUGS = ["estaciones-de-carburacion", "planta-ficha-tecnica"];
