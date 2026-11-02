import { CAMPOS_POR_TIPO, TIPOS_LOTE, esPruebaDeTanque, tipoAplicaEnApartado, type CampoItem, type TipoLote } from "@/lib/lote-documentos";
import { ESTACION_LIKE_SECTION_SLUGS } from "@/lib/estacion-sections";
import { isAlertVisibleForSection } from "@/lib/alert-visibility";

// Registro en lote: el mismo registro de bitácora (con todos sus campos) para
// varias unidades a la vez. Sin Prisma ni nada de servidor: lo importan la
// página, la acción y la pantalla. Los campos de cada tipo salen de
// CAMPOS_POR_TIPO (lib/lote-documentos.ts), los mismos del formulario de la
// bitácora y de la carga de documentos escaneados.

// "Otro documento de la unidad" necesita un archivo: no es un registro en lote.
export const TIPOS_EN_LOTE: TipoLote[] = TIPOS_LOTE.filter((t) => t !== "UNIDAD");

export function esTipoEnLote(valor: unknown): valor is TipoLote {
  return typeof valor === "string" && (TIPOS_EN_LOTE as string[]).includes(valor);
}

// Lo que es distinto en cada unidad aunque el trabajo sea el mismo día: el
// número del ultrasonido o de la prueba (cada dictamen trae el suyo), el
// kilometraje de cada camión, la fecha de fabricación de cada manguera. Esos
// campos se capturan en una columna por unidad, no «igual para todas». El
// extintor sí se cambia casi todo junto, y la póliza suele ser una sola para
// varias unidades: esos dos van «igual para todas».
export const CAMPOS_POR_UNIDAD: Record<TipoLote, CampoItem[]> = {
  ULTRASONIDO: ["numero"],
  VISUAL_EXTERNA: ["numero"],
  HERMETICIDAD: ["numero"],
  VISUAL_INTERNA: ["numero"],
  HIDROSTATICA: ["numero"],
  MANTENIMIENTO: ["kilometraje"],
  EXTINTOR: [],
  MANGUERAS: ["fechaFabricacion"],
  POLIZA: [],
  UNIDAD: [],
};

export function camposPorUnidad(tipo: TipoLote): CampoItem[] {
  return CAMPOS_POR_UNIDAD[tipo];
}

// En las pruebas e inspecciones el formulario de la bitácora deja el número
// opcional (a veces el dictamen aún no llega), pero en el registro en lote se
// pide: la idea es que cada unidad quede con el suyo y no se vaya vacío.
export function numeroObligatorioEnLote(tipo: TipoLote): boolean {
  return CAMPOS_POR_UNIDAD[tipo].includes("numero");
}

// Los campos que se piden para registrar este tipo en lote o desde Excel:
// los obligatorios del formulario de la bitácora (CAMPOS_POR_TIPO) más el
// número cuando cada unidad trae el suyo.
export function camposObligatoriosEnLote(tipo: TipoLote): CampoItem[] {
  const base = CAMPOS_POR_TIPO[tipo].filter((d) => d.requerido).map((d) => d.campo);
  if (numeroObligatorioEnLote(tipo) && !base.includes("numero")) base.push("numero");
  return base;
}

export function etiquetaDeCampo(tipo: TipoLote, campo: CampoItem): string {
  return CAMPOS_POR_TIPO[tipo].find((d) => d.campo === campo)?.etiqueta ?? campo;
}

// Compara números de registro sin que importen mayúsculas, espacios ni
// guiones: «US-012» y «us 012» son el mismo número.
export function claveDeNumero(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// Números que aparecen en más de una unidad. Devuelve, por cada número
// repetido, las unidades que lo traen (para decir cuáles son).
export function numerosRepetidos(filas: { unidad: string; numero: string }[]): { numero: string; unidades: string[] }[] {
  const grupos = new Map<string, { numero: string; unidades: string[] }>();
  for (const f of filas) {
    const clave = claveDeNumero(f.numero);
    if (!clave) continue;
    const g = grupos.get(clave) ?? { numero: f.numero.trim(), unidades: [] };
    g.unidades.push(f.unidad);
    grupos.set(clave, g);
  }
  return Array.from(grupos.values()).filter((g) => g.unidades.length > 1);
}

// Numera en serie: «US-» desde 1 con 3 dígitos → US-001, US-002...
// Respeta los ceros a la izquierda del número inicial si se escribe con ellos
// («007» → 007, 008, ...).
export function numerarEnSerie(prefijo: string, desde: string, cantidad: number): string[] {
  const inicio = Number.parseInt(desde, 10);
  if (!Number.isFinite(inicio) || inicio < 0 || cantidad <= 0) return [];
  const ancho = /^0\d+$/.test(desde.trim()) ? desde.trim().length : 0;
  return Array.from({ length: cantidad }, (_, i) => `${prefijo}${String(inicio + i).padStart(ancho, "0")}`);
}

// A qué unidades se les puede registrar este tipo en lote. Las pruebas del
// tanque de estaciones y planta van por tanque (cada tanque tiene su
// historial), así que se registran en la ficha de cada una, no en lote.
export function aplicaEnLote(tipo: TipoLote, sectionSlug: string): boolean {
  if (!tipoAplicaEnApartado(tipo, sectionSlug)) return false;
  const estacion = ESTACION_LIKE_SECTION_SLUGS.includes(sectionSlug);
  if (esPruebaDeTanque(tipo) && estacion) return false;
  // Un reparto copiado a carburación comparte extintor con su gemelo: el
  // extintor se registra una sola vez, en reparto.
  if (tipo === "EXTINTOR") return !estacion && isAlertVisibleForSection("extintor", sectionSlug);
  return true;
}
