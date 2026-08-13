// Catálogo de Marca/Línea/Modelo para la sección "Automóvil" de la ficha
// técnica (ver components/admin/TechnicalSheetForm.tsx): al elegir una marca
// conocida, si esa marca solo tiene una línea o un modelo posibles se
// autorellenan solos (la persona los puede cambiar a mano después, por si la
// unidad real no es ninguna de las opciones listadas aquí). "Otro" deja
// escribir la marca a mano, para lo que no esté en la lista.
export interface VehicleBrandOption {
  marca: string;
  lineas: string[];
  modelos: string[];
}

export const VEHICLE_BRAND_CATALOG: VehicleBrandOption[] = [
  { marca: "Kenworth", lineas: ["T370"], modelos: ["Camión"] },
  { marca: "Ford", lineas: ["F-350"], modelos: ["Super Duty"] },
  { marca: "Dodge", lineas: ["4000"], modelos: ["RAM"] },
  { marca: "Chevrolet", lineas: ["1500", "2500"], modelos: [] },
  { marca: "Nissan", lineas: [], modelos: ["NP300"] },
  { marca: "Toyota", lineas: [], modelos: ["Hilux"] },
];

// Valor centinela para la opción "Otro" en el <select> de marca: no puede
// coincidir con ninguna marca real del catálogo.
export const OTRA_MARCA = "__OTRA__";

// Busca sin importar mayúsculas/minúsculas ni espacios de sobra, para
// reconocer una marca ya escrita a mano antes de que existiera este
// catálogo (ver TechnicalSheetForm.tsx: se usa para preseleccionar el
// <select> al abrir la ficha técnica de una unidad ya existente).
export function findBrandOption(marca: string | null | undefined): VehicleBrandOption | undefined {
  if (!marca) return undefined;
  const normalized = marca.trim().toLowerCase();
  return VEHICLE_BRAND_CATALOG.find((option) => option.marca.toLowerCase() === normalized);
}
