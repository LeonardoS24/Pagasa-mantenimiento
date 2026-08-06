import { prisma } from "@/lib/prisma";
import { accionPiezaOptions, type AccionPieza } from "@/lib/piece-catalog";

export interface PieceMaintenanceStat {
  categoria: string | null;
  pieza: string;
  total: number;
  porAccion: Record<AccionPieza, number>;
}

// Cuenta, por pieza, cuántos mantenimientos tuvo desglosados por acción
// (Sustitución / Reparación / Mantenimiento preventivo). Solo cuentan los
// registros donde se capturó tanto la pieza como la acción (campo nuevo, ver
// components/admin/CreateMaintenanceLogForm.tsx): los mantenimientos previos
// a este cambio no tienen esa acción y no entran al desglose.
//
// Se agrupa por categoría + pieza, no solo por el nombre de la pieza: varios
// nombres se repiten en categorías distintas con significados distintos
// (p. ej. "Mangueras" existe en Combustible, Enfriamiento y Aire
// Acondicionado; "Válvulas" existe en Motor y en Llantas y Rines). Agrupar
// solo por nombre mezclaría mantenimientos de piezas que no tienen nada que
// ver entre sí.
export async function getPieceMaintenanceStats(
  cityId: string,
  limit = 10
): Promise<PieceMaintenanceStat[]> {
  const logs = await prisma.maintenanceLog.findMany({
    where: {
      vehicleRecord: { section: { cityId } },
      pieza: { not: null },
      accionPieza: { not: null },
    },
    select: { categoriaPieza: true, pieza: true, accionPieza: true },
  });

  const byKey = new Map<string, PieceMaintenanceStat>();
  for (const log of logs) {
    const pieza = log.pieza!;
    const categoria = log.categoriaPieza;
    const accion = log.accionPieza as AccionPieza;
    if (!accionPiezaOptions.includes(accion)) continue;
    const key = `${categoria ?? ""}::${pieza}`;
    let stat = byKey.get(key);
    if (!stat) {
      stat = {
        categoria,
        pieza,
        total: 0,
        porAccion: { Sustitución: 0, Reparación: 0, "Mantenimiento preventivo": 0 },
      };
      byKey.set(key, stat);
    }
    stat.porAccion[accion] += 1;
    stat.total += 1;
  }

  return Array.from(byKey.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}
