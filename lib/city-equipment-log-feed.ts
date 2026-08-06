import { prisma } from "@/lib/prisma";
import { equipoColorKey, type BadgeColorKey } from "@/lib/section-colors";

export interface EquipmentLogEvent {
  id: string;
  fecha: Date;
  tipo: string;
  colorKey: BadgeColorKey;
  equipoId: string;
  nombreEquipo: string;
  detalle: string;
}

// Bitácora única de equipos a nivel ciudad, ordenada por fecha y coloreada
// según el tipo del equipo al que pertenece cada registro (mecánico,
// eléctrico/electrónico o auxiliar — ver lib/equipo-enums.ts).
export async function getCityEquipmentLogFeed(cityId: string): Promise<EquipmentLogEvent[]> {
  const logs = await prisma.equipmentLog.findMany({
    where: { equipo: { section: { cityId } } },
    orderBy: { fecha: "desc" },
    take: 150,
    include: { equipo: { select: { id: true, nombre: true, tipoEquipo: true } } },
  });

  return logs.map((log) => ({
    id: log.id,
    fecha: log.fecha,
    tipo: `${log.tipoMantenimiento} — Equipo`,
    colorKey: equipoColorKey(log.equipo.tipoEquipo),
    equipoId: log.equipoId,
    nombreEquipo: log.equipo.nombre,
    detalle: log.descripcion,
  }));
}
