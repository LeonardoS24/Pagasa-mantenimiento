// Las 15 áreas operativas fijas de una Planta almacenadora de GLP (texto
// exacto de las normas que rigen la operación de la planta). No son filas
// editables de una tabla: son la misma lista fija en toda la app. Hoy se usan
// como el catálogo de ubicaciones de los equipos de Planta, que se eligen de
// aquí en vez de escribirse a mano (ver Equipo.ubicacion y EquipoForm).
export const PLANT_AREAS = [
  { clave: "A", nombre: "Báscula de pesaje de unidades" },
  { clave: "B", nombre: "Área de recepción de GLP mediante semirremolque" },
  { clave: "C", nombre: "Área de suministro a auto-tanques" },
  { clave: "D", nombre: "Área de almacenamiento de GLP" },
  { clave: "E", nombre: "Área de revisión de recipientes portátiles y/o transportables sujetos a presión" },
  { clave: "F", nombre: "Muelle de llenado de recipientes portátiles y/o transportables sujetos a presión" },
  { clave: "G", nombre: "Área de resguardo de recipientes portátiles y/o transportables sujetos a presión" },
  { clave: "H", nombre: "Área de vaciado de GLP de los recipientes portátiles y/o transportables sujetos a presión" },
  { clave: "I", nombre: "Área de suministro para carburación de vehículos propios" },
  { clave: "J", nombre: "Taller para el mantenimiento de recipientes portátiles y/o transportables sujetos a presión" },
  { clave: "K", nombre: "Taller para reparación de vehículos" },
  { clave: "L", nombre: "Áreas para el resguardo de auto-tanques y vehículos de reparto" },
  { clave: "M", nombre: "Área de equipo contra incendio" },
  { clave: "N", nombre: "Área de almacenamiento de recipientes portátiles y/o transportables sujetos a presión inmovilizados" },
  { clave: "O", nombre: "Oficinas administrativas operativas" },
] as const;

export type PlantAreaClave = (typeof PLANT_AREAS)[number]["clave"];

export const PLANT_AREA_CLAVES: PlantAreaClave[] = PLANT_AREAS.map((a) => a.clave);

export const PLANT_AREA_NAMES: string[] = PLANT_AREAS.map((a) => a.nombre);

export function plantAreaNombre(clave: string): string {
  return PLANT_AREAS.find((a) => a.clave === clave)?.nombre ?? clave;
}

export function isPlantAreaClave(clave: string): clave is PlantAreaClave {
  return PLANT_AREA_CLAVES.includes(clave as PlantAreaClave);
}
