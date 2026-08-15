import { normalizeForSearch } from "@/lib/text-normalize";

// Ámbitos de búsqueda: permiten acotar la búsqueda a una parte concreta de la
// ficha en vez de buscar en todo. Se usan de dos formas, que hacen lo mismo:
//
//   1. Escribiendo el ámbito antes del término: "tanque 5000" busca "5000"
//      solo dentro de los datos del tanque; "ultrasonido 192" busca "192"
//      solo en lo del ultrasonido.
//   2. Eligiéndolo en el selector de al lado del buscador.
//
// `groups` son los mismos nombres de recuadro que ya usa la página de
// búsqueda para decir dónde encontró cada coincidencia (ver
// vehicleMatchedGroups en app/(protected)/buscar/page.tsx).
export interface SearchScope {
  id: string;
  label: string;
  // Palabras que, escritas al inicio de la búsqueda, activan este ámbito.
  keywords: string[];
  groups: string[];
}

export const SEARCH_SCOPES: SearchScope[] = [
  {
    id: "datos-generales",
    label: "Datos generales",
    keywords: ["datos generales", "generales", "unidad", "economico"],
    groups: ["Datos generales"],
  },
  {
    id: "automovil",
    label: "Automóvil",
    keywords: ["automovil", "auto", "vehiculo", "carro"],
    groups: ["Ficha técnica · Automóvil"],
  },
  {
    id: "tanque",
    label: "Tanque",
    // Cubre los dos: el tanque de carga de una unidad y el tanque fijo de una
    // Estación/Planta. Quien busca "tanque 5000" no está pensando en cuál de
    // los dos modelos guarda ese dato.
    keywords: ["tanque", "tanques"],
    groups: ["Ficha técnica · Tanque", "Estación · Tanque"],
  },
  {
    id: "valvulas",
    label: "Válvulas",
    keywords: ["valvula", "valvulas"],
    groups: ["Ficha técnica · Válvulas", "Estación · Válvulas"],
  },
  {
    id: "extintor",
    label: "Extintor",
    keywords: ["extintor", "extintores"],
    groups: ["Ficha técnica · Extintor"],
  },
  {
    id: "ultrasonido",
    label: "Ultrasonido",
    keywords: ["ultrasonido", "ultrasonidos"],
    groups: ["Ficha técnica · Ultrasonido"],
  },
  {
    id: "visual-externa",
    label: "Inspección visual externa",
    keywords: ["visual externa", "inspeccion visual externa", "visual"],
    groups: ["Ficha técnica · Inspección Visual Externa"],
  },
  {
    id: "visual-interna",
    label: "Inspección visual interna",
    keywords: ["visual interna", "inspeccion visual interna"],
    groups: ["Ficha técnica · Inspección Visual Interna"],
  },
  {
    id: "hermeticidad",
    label: "Prueba de hermeticidad",
    keywords: ["hermeticidad", "prueba de hermeticidad"],
    groups: ["Ficha técnica · Prueba de Hermeticidad"],
  },
  {
    id: "hidrostatica",
    label: "Prueba hidrostática",
    keywords: ["hidrostatica", "prueba hidrostatica"],
    groups: ["Ficha técnica · Prueba Hidrostática"],
  },
  {
    id: "chofer",
    label: "Chofer y póliza",
    keywords: ["chofer", "poliza", "inciso", "seguro"],
    groups: ["Ficha técnica · Chofer y póliza"],
  },
  {
    id: "estacion",
    label: "Estación / Planta",
    keywords: ["estacion", "estaciones", "planta", "permiso", "permisionaria"],
    groups: ["Estación · Datos", "Estación · Tanque", "Estación · Válvulas"],
  },
];

export function findScopeById(id: string | null | undefined): SearchScope | null {
  if (!id) return null;
  return SEARCH_SCOPES.find((s) => s.id === id) ?? null;
}

export interface ParsedQuery {
  scope: SearchScope | null;
  // Lo que hay que buscar, ya sin la palabra del ámbito.
  term: string;
  // true cuando el ámbito salió de escribirlo (no del selector): sirve para
  // avisarle al usuario qué interpretó el buscador.
  scopeFromText: boolean;
}

// Para comparar la palabra del ámbito: además de lo que hace
// normalizeForSearch (minúsculas, sin espacios ni guiones) también quita
// acentos, porque nadie escribe "hidrostática" con acento en un buscador.
function normalizeScopeWord(value: string): string {
  return normalizeForSearch(value.normalize("NFD").replace(/[̀-ͯ]/g, ""));
}

// Cuántos caracteres del texto original ocupan los primeros `n` caracteres
// ya normalizados. Hace falta porque normalizeScopeWord quita espacios, así
// que no se puede cortar el texto original por la longitud de la palabra
// normalizada ("visual externa" son 14 caracteres, pero 13 normalizados).
function rawLengthForNormalized(raw: string, n: number): number {
  let contados = 0;
  for (let i = 0; i < raw.length; i++) {
    contados += normalizeScopeWord(raw[i]).length;
    if (contados >= n) return i + 1;
  }
  return raw.length;
}

// Separa "tanque 5000" en { scope: Tanque, term: "5000" }. Si lo escrito es
// solo el nombre del ámbito ("tanque", sin nada más), NO se acota: se busca
// esa palabra en todo, que es lo que la gente espera al escribir una sola
// palabra. El ámbito elegido en el selector (scopeId) gana sobre el texto.
export function parseScopedQuery(raw: string, scopeId?: string | null): ParsedQuery {
  const q = raw.trim();
  const fromSelector = findScopeById(scopeId);
  if (fromSelector) return { scope: fromSelector, term: q, scopeFromText: false };

  const qNorm = normalizeScopeWord(q);
  // Las palabras más largas primero: "visual externa" antes que "visual".
  const candidatos = SEARCH_SCOPES.flatMap((scope) =>
    scope.keywords.map((keyword) => ({ scope, keyword: normalizeScopeWord(keyword) }))
  ).sort((a, b) => b.keyword.length - a.keyword.length);

  for (const { scope, keyword } of candidatos) {
    if (!qNorm.startsWith(keyword)) continue;
    const resto = q.slice(rawLengthForNormalized(q, keyword.length)).trim();
    // Solo la palabra del ámbito: se busca normal, sin acotar.
    if (!resto) continue;
    return { scope, term: resto, scopeFromText: true };
  }

  return { scope: null, term: q, scopeFromText: false };
}
