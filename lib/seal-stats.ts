import { prisma } from "@/lib/prisma";

export interface SealStationOption {
  id: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
}

// Estaciones para el selector del listado de sellos en Administración /
// Resumen (ver components/admin/ResumenPanel.tsx): hay que elegir una para
// ver sus sellos, en vez de mezclar todas en una sola lista.
export async function getStationsForSealSelect(cityIds: string[]): Promise<SealStationOption[]> {
  if (cityIds.length === 0) return [];
  const estaciones = await prisma.vehicleRecord.findMany({
    where: { section: { slug: "estaciones-de-carburacion", cityId: { in: cityIds } } },
    select: {
      id: true,
      numeroEconomico: true,
      activo: true,
      section: { select: { city: { select: { slug: true, name: true } } } },
    },
    orderBy: [{ activo: "desc" }, { numeroEconomico: "asc" }],
  });
  return estaciones.map((e) => ({
    id: e.id,
    numeroEconomico: e.numeroEconomico,
    citySlug: e.section.city.slug,
    cityName: e.section.city.name,
  }));
}

export interface SealRow {
  id: string;
  numeroSello: string;
  fechaInstalacion: Date;
  fechaBaja: Date | null;
  motivoBaja: string | null;
  deactivatedByUsername: string | null;
}

export interface StationSeals {
  activos: SealRow[];
  historial: SealRow[];
}

// Los sellos activos y el historial de bajas de UNA estación en particular
// (con qué perfil dio de baja cada uno) — ver apartado "Sellos" en la
// página de detalle del vehículo, mismo criterio.
export async function getStationSeals(vehicleRecordId: string): Promise<StationSeals> {
  const logs = await prisma.sealLog.findMany({
    where: { vehicleRecordId },
    include: { deactivatedBy: { select: { username: true } } },
    orderBy: { fechaInstalacion: "desc" },
  });

  const toRow = (log: (typeof logs)[number]): SealRow => ({
    id: log.id,
    numeroSello: log.numeroSello,
    fechaInstalacion: log.fechaInstalacion,
    fechaBaja: log.fechaBaja,
    motivoBaja: log.motivoBaja,
    deactivatedByUsername: log.deactivatedBy?.username ?? null,
  });

  const activos = logs.filter((l) => l.activo).map(toRow);
  const historial = logs
    .filter((l) => !l.activo)
    .map(toRow)
    .sort((a, b) => (b.fechaBaja?.getTime() ?? 0) - (a.fechaBaja?.getTime() ?? 0));

  return { activos, historial };
}
