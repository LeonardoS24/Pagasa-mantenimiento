import { prisma } from "@/lib/prisma";
import { PIECE_CATEGORY_OTRO, getAllStaticPieceNames } from "@/lib/piece-catalog";

// A partir de cuántas veces se escribe la MISMA pieza a mano se agrega sola
// al catálogo (ver maybeLearnPiece). 3 para no meter errores de dedo o
// nombres de un solo uso, pero sin tardar demasiado en aprenderla.
const LEARN_THRESHOLD = 3;

// Comparación insensible a mayúsculas/minúsculas Y a acentos (SQLite solo
// hace mayúsculas/minúsculas de forma nativa para ASCII, así que "Válvula"
// vs "VÁLVULA" no se igualarían en una consulta normal): todo se compara ya
// normalizado en JS, nunca en la base.
export function normalizePieceName(nombre: string): string {
  return nombre.trim().toLowerCase();
}

// Nombres de pieza ya conocidos (catálogo fijo + ya aprendidas), normalizados
// para poder comparar. Se usa tanto para no re-aprender algo que ya está
// como para ofrecer las piezas aprendidas en el formulario.
export async function getLearnedPieces(): Promise<{ categoria: string; nombre: string }[]> {
  return prisma.learnedPiece.findMany({ orderBy: { nombre: "asc" } });
}

// Se llama después de crear un MaintenanceLog con pieza escrita a mano
// (categoría vacía o "Otro" — cualquier otra categoría viene de una lista
// fija, no se escribe libre). Cuenta cuántas veces se ha usado ese mismo
// nombre (sin importar mayúsculas/minúsculas/acentos) entre todos los
// registros existentes y, si llega al umbral y todavía no está en el
// catálogo (fijo ni aprendido), lo agrega.
export async function maybeLearnPiece(pieza: string): Promise<void> {
  const texto = pieza.trim();
  if (!texto) return;
  const normalizado = normalizePieceName(texto);

  const [staticNames, learned] = await Promise.all([
    Promise.resolve(getAllStaticPieceNames()),
    getLearnedPieces(),
  ]);
  const yaConocida =
    staticNames.some((n) => normalizePieceName(n) === normalizado) ||
    learned.some((l) => normalizePieceName(l.nombre) === normalizado);
  if (yaConocida) return;

  // Todas las piezas escritas a mano alguna vez, sin importar en qué
  // registro ni con qué categoría exacta (vacía o "Otro" cuentan igual: es
  // la misma acción de "no la encontré en la lista, la escribo").
  const registros = await prisma.maintenanceLog.findMany({
    where: {
      pieza: { not: null },
      OR: [{ categoriaPieza: null }, { categoriaPieza: "" }, { categoriaPieza: PIECE_CATEGORY_OTRO }],
    },
    select: { pieza: true },
  });
  const usos = registros.filter((r) => r.pieza && normalizePieceName(r.pieza) === normalizado).length;
  if (usos < LEARN_THRESHOLD) return;

  // try/catch en vez de skipDuplicates (createMany no lo soporta en SQLite):
  // el índice único (categoria, nombre) protege igual si dos registros
  // llegan al umbral casi al mismo tiempo, solo lo hace silencioso.
  try {
    await prisma.learnedPiece.create({ data: { categoria: PIECE_CATEGORY_OTRO, nombre: texto } });
  } catch {
    // Ya existe (condición de carrera) — no pasa nada.
  }
}
