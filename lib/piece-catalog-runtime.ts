import { prisma } from "@/lib/prisma";
import {
  PIECE_CATALOG,
  PIECE_CATEGORY_OTRO,
  STATION_PIECE_CATEGORIES,
  CATEGORIAS_MECANICAS_RETIRADAS,
  CATEGORIAS_RENOMBRADAS,
  getPieceCategories,
  getPieceCategoriesForGroup,
  type PieceGroup,
} from "@/lib/piece-catalog";
import { normalizePieceName } from "@/lib/learned-pieces";

// El catálogo de piezas es la lista fija de lib/piece-catalog.ts MÁS las
// piezas que se agreguen desde el panel de administración (ver /admin/piezas
// y actions/piece-catalog-actions.ts), guardadas en la tabla learned_pieces.
//
// Los formularios siempre deben leerlo con estas funciones, no importando
// PIECE_CATALOG directo: si no, las piezas agregadas a mano no aparecerían.
export type PieceCatalog = Record<string, string[]>;

export const GRUPO_UNIDADES = "UNIDADES";
export const GRUPO_ESTACIONES = "ESTACIONES";

export function grupoDeCategoria(categoria: string, grupoGuardado?: string | null): PieceGroup {
  if (STATION_PIECE_CATEGORIES.includes(categoria)) return "Estaciones de carburación";
  if (grupoGuardado === GRUPO_ESTACIONES) return "Estaciones de carburación";
  return "Unidades";
}

type ExtraPiece = { categoria: string; nombre: string; grupo: string | null };

// Para los formularios: las piezas de categorías mecánicas retiradas ya no
// se ofrecen (el mantenimiento es de gas, ver lib/piece-catalog.ts), y las de
// una categoría que cambió de nombre se ofrecen con el nombre nuevo. El
// panel (getPiezasAgregadas) las sigue listando tal cual, para poder
// quitarlas.
async function getExtraPieces(): Promise<ExtraPiece[]> {
  const filas = await prisma.learnedPiece.findMany({
    where: { categoria: { notIn: [PIECE_CATEGORY_OTRO, ...CATEGORIAS_MECANICAS_RETIRADAS] } },
    orderBy: { nombre: "asc" },
    select: { categoria: true, nombre: true, grupo: true },
  });
  return filas.map((f) => ({ ...f, categoria: CATEGORIAS_RENOMBRADAS[f.categoria] ?? f.categoria }));
}

export async function getPieceCatalog(): Promise<PieceCatalog> {
  const extra = await getExtraPieces();

  const catalogo: PieceCatalog = {};
  for (const [categoria, piezas] of Object.entries(PIECE_CATALOG)) {
    catalogo[categoria] = [...piezas];
  }

  for (const pieza of extra) {
    const actuales = catalogo[pieza.categoria] ?? [];
    const yaEsta = actuales.some((p) => normalizePieceName(p) === normalizePieceName(pieza.nombre));
    catalogo[pieza.categoria] = yaEsta ? actuales : [...actuales, pieza.nombre];
  }

  return catalogo;
}

// Categorías nuevas (creadas desde el panel, no están en la lista fija) que
// pertenecen a este grupo.
async function getCategoriasNuevas(grupo: PieceGroup): Promise<string[]> {
  const extra = await getExtraPieces();
  const nuevas = new Set<string>();
  for (const pieza of extra) {
    if (pieza.categoria in PIECE_CATALOG) continue;
    if (grupoDeCategoria(pieza.categoria, pieza.grupo) === grupo) nuevas.add(pieza.categoria);
  }
  return [...nuevas].sort((a, b) => a.localeCompare(b));
}

// Igual que getPieceCategories (lib/piece-catalog.ts) pero incluyendo las
// categorías creadas desde el panel que le tocan a ese apartado. "Otro"
// siempre se queda al final.
export async function getPieceCategoriesWithExtras(sectionSlug?: string): Promise<string[]> {
  const base = getPieceCategories(sectionSlug);
  const esEstacion = base.some((c) => STATION_PIECE_CATEGORIES.includes(c));
  const nuevas = await getCategoriasNuevas(esEstacion ? "Estaciones de carburación" : "Unidades");
  if (nuevas.length === 0) return base;
  return [...base.filter((c) => c !== PIECE_CATEGORY_OTRO), ...nuevas, PIECE_CATEGORY_OTRO];
}

// Mismo agrupado que el formulario de órdenes (Unidades / Estaciones de
// carburación), incluyendo las categorías creadas desde el panel.
export async function getPieceCategoriesForGroupWithExtras(grupo: PieceGroup): Promise<string[]> {
  const base = getPieceCategoriesForGroup(grupo);
  const nuevas = await getCategoriasNuevas(grupo);
  return [...base, ...nuevas];
}

// Para el panel: todas las categorías de cada grupo (fijas + nuevas), para
// poder elegir dónde agregar una pieza.
export async function getCategoriasPorGrupo(): Promise<Record<PieceGroup, string[]>> {
  return {
    Unidades: await getPieceCategoriesForGroupWithExtras("Unidades"),
    "Estaciones de carburación": await getPieceCategoriesForGroupWithExtras("Estaciones de carburación"),
  };
}

// Piezas agregadas a mano (las únicas que se pueden borrar desde el panel:
// las de la lista fija viven en el código).
export async function getPiezasAgregadas(): Promise<
  { id: string; categoria: string; nombre: string; grupo: PieceGroup; createdAt: Date }[]
> {
  const filas = await prisma.learnedPiece.findMany({
    where: { categoria: { not: PIECE_CATEGORY_OTRO } },
    orderBy: [{ categoria: "asc" }, { nombre: "asc" }],
  });
  return filas.map((f) => ({
    id: f.id,
    categoria: f.categoria,
    nombre: f.nombre,
    grupo: grupoDeCategoria(f.categoria, f.grupo),
    createdAt: f.createdAt,
  }));
}
