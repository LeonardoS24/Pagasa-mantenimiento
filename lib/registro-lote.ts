import { TIPOS_LOTE, esPruebaDeTanque, tipoAplicaEnApartado, type TipoLote } from "@/lib/lote-documentos";
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
