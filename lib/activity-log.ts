import { prisma } from "@/lib/prisma";

export interface ActivityEvent {
  id: string;
  tipo: string;
  detalle: string;
  citySlug: string;
  cityName: string;
  createdAt: Date;
  createdByUsername: string | null;
  href: string;
}

// Cuántos de cada tipo se traen antes de combinar y recortar al total: sin
// esto, un tipo muy activo podría acaparar todo el listado y ocultar
// actividad reciente de los demás.
const TAKE = 60;

const cityInclude = { section: { select: { city: { select: { slug: true, name: true } } } } } as const;
const creatorInclude = { createdBy: { select: { username: true } } } as const;

// Todo lo nuevo que se agrega en el sistema (unidades, equipos, mantenimientos
// y el resto de los tipos de registro), quién lo hizo y de qué ciudad es, para
// la bitácora de actividad de administración (ver
// app/(protected)/admin/actividad). Se ordena por fecha de creación (no la
// fecha "de negocio" del registro, que puede capturarse atrasada).
export async function getSystemActivityFeed(limit = 200): Promise<ActivityEvent[]> {
  const [
    vehicles,
    equipos,
    mantenimiento,
    ultrasonido,
    visualExterna,
    hermeticidad,
    visualInterna,
    hidrostatica,
    extintor,
    valvulas,
    valvulasCorrectivo,
    mangueras,
    equipmentLogs,
  ] = await Promise.all([
    prisma.vehicleRecord.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, ...cityInclude },
    }),
    prisma.equipo.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, ...cityInclude },
    }),
    prisma.maintenanceLog.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.ultrasoundLog.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.visualInspectionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.tightnessTestLog.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.internalVisualInspectionLog.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.hydrostaticTestLog.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.extinguisherChangeLog.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.valveChangeLog.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.valveCorrectiveMaintenanceLog.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.hoseChangeLog.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: { ...creatorInclude, vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.equipmentLog.findMany({
      orderBy: { createdAt: "desc" },
      take: TAKE,
      include: {
        ...creatorInclude,
        equipo: { select: { nombre: true, codigo: true, ...cityInclude } },
      },
    }),
  ]);

  const events: ActivityEvent[] = [
    ...vehicles.map((v) => ({
      id: `unidad-${v.id}`,
      tipo: "Unidad nueva",
      detalle: `${v.numeroEconomico} — ${v.sucursal}`,
      citySlug: v.section.city.slug,
      cityName: v.section.city.name,
      createdAt: v.createdAt,
      createdByUsername: v.createdBy?.username ?? null,
      href: `/ciudades/${v.section.city.slug}/vehiculo/${v.id}`,
    })),
    ...equipos.map((e) => ({
      id: `equipo-${e.id}`,
      tipo: "Equipo nuevo",
      detalle: e.codigo ? `${e.codigo} — ${e.nombre}` : e.nombre,
      citySlug: e.section.city.slug,
      cityName: e.section.city.name,
      createdAt: e.createdAt,
      createdByUsername: e.createdBy?.username ?? null,
      href: `/ciudades/${e.section.city.slug}/equipo/${e.id}`,
    })),
    ...mantenimiento.map((m) => ({
      id: `mantenimiento-${m.id}`,
      tipo: "Mantenimiento",
      detalle: `${m.vehicleRecord.numeroEconomico} — ${m.tipoMantenimiento} / ${m.tipoServicio}`,
      citySlug: m.vehicleRecord.section.city.slug,
      cityName: m.vehicleRecord.section.city.name,
      createdAt: m.createdAt,
      createdByUsername: m.createdBy?.username ?? null,
      href: `/ciudades/${m.vehicleRecord.section.city.slug}/vehiculo/${m.vehicleRecordId}?mantenimiento=${m.id}`,
    })),
    ...ultrasonido.map((log) => ({
      id: `ultrasonido-${log.id}`,
      tipo: "Ultrasonido",
      detalle: `${log.vehicleRecord.numeroEconomico}${log.numeroUltrasonido ? ` — No. ${log.numeroUltrasonido}` : ""}`,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      createdAt: log.createdAt,
      createdByUsername: log.createdBy?.username ?? null,
      href: `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`,
    })),
    ...visualExterna.map((log) => ({
      id: `visual-externa-${log.id}`,
      tipo: "Inspección Visual Externa",
      detalle: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      createdAt: log.createdAt,
      createdByUsername: log.createdBy?.username ?? null,
      href: `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`,
    })),
    ...hermeticidad.map((log) => ({
      id: `hermeticidad-${log.id}`,
      tipo: "Prueba de Hermeticidad",
      detalle: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      createdAt: log.createdAt,
      createdByUsername: log.createdBy?.username ?? null,
      href: `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`,
    })),
    ...visualInterna.map((log) => ({
      id: `visual-interna-${log.id}`,
      tipo: "Inspección Visual Interna",
      detalle: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      createdAt: log.createdAt,
      createdByUsername: log.createdBy?.username ?? null,
      href: `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`,
    })),
    ...hidrostatica.map((log) => ({
      id: `hidrostatica-${log.id}`,
      tipo: "Prueba Hidrostática",
      detalle: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      createdAt: log.createdAt,
      createdByUsername: log.createdBy?.username ?? null,
      href: `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`,
    })),
    ...extintor.map((log) => ({
      id: `extintor-${log.id}`,
      tipo: "Cambio de Extintor",
      detalle: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      createdAt: log.createdAt,
      createdByUsername: log.createdBy?.username ?? null,
      href: `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`,
    })),
    ...valvulas.map((log) => ({
      id: `valvulas-${log.id}`,
      tipo: "Cambio de Válvulas",
      detalle: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      createdAt: log.createdAt,
      createdByUsername: log.createdBy?.username ?? null,
      href: `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`,
    })),
    ...valvulasCorrectivo.map((log) => ({
      id: `valvulas-correctivo-${log.id}`,
      tipo: "Mantenimiento correctivo de válvulas",
      detalle: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      createdAt: log.createdAt,
      createdByUsername: log.createdBy?.username ?? null,
      href: `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`,
    })),
    ...mangueras.map((log) => ({
      id: `mangueras-${log.id}`,
      tipo: "Cambio de Mangueras",
      detalle: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      createdAt: log.createdAt,
      createdByUsername: log.createdBy?.username ?? null,
      href: `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`,
    })),
    ...equipmentLogs.map((log) => ({
      id: `equipo-log-${log.id}`,
      tipo: "Mantenimiento de equipo",
      detalle: log.equipo.codigo ? `${log.equipo.codigo} — ${log.equipo.nombre}` : log.equipo.nombre,
      citySlug: log.equipo.section.city.slug,
      cityName: log.equipo.section.city.name,
      createdAt: log.createdAt,
      createdByUsername: log.createdBy?.username ?? null,
      href: `/ciudades/${log.equipo.section.city.slug}/equipo/${log.equipoId}`,
    })),
  ];

  events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return events.slice(0, limit);
}
