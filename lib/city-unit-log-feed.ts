import { prisma } from "@/lib/prisma";
import type { BadgeColorKey } from "@/lib/section-colors";
import { maintenanceStatusLabels, calidadExtintorLabels, type MaintenanceStatus, type CalidadExtintor } from "@/lib/vehicle-enums";
import { valvulaCorrectivaLabels, type ValvulaCorrectiva } from "@/lib/valve-alerts";

export interface UnitLogEvent {
  id: string;
  fecha: Date;
  tipo: string;
  colorKey: BadgeColorKey;
  vehicleRecordId: string;
  numeroEconomico: string;
  detalle: string;
}

const TAKE = 100;

// Reúne los 10 tipos de bitácora de una unidad más el evento "Dado de baja"
// en un solo feed cronológico a nivel ciudad. Cada tipo vive en su propio
// modelo (ver prisma/schema.prisma), así que se consultan por separado y se
// combinan en memoria — no hay forma de hacer esto en una sola consulta SQL
// porque son tablas distintas sin una columna de tipo compartida.
export async function getCityUnitLogFeed(cityId: string): Promise<UnitLogEvent[]> {
  const vehicleWhere = { section: { cityId } };

  const [
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
    bajas,
  ] = await Promise.all([
    prisma.maintenanceLog.findMany({
      where: { vehicleRecord: vehicleWhere },
      orderBy: { fecha: "desc" },
      take: TAKE,
      include: { vehicleRecord: { select: { numeroEconomico: true } } },
    }),
    prisma.ultrasoundLog.findMany({
      where: { vehicleRecord: vehicleWhere },
      orderBy: { fechaRealizacion: "desc" },
      take: TAKE,
      include: { vehicleRecord: { select: { numeroEconomico: true } } },
    }),
    prisma.visualInspectionLog.findMany({
      where: { vehicleRecord: vehicleWhere },
      orderBy: { fechaRealizacion: "desc" },
      take: TAKE,
      include: { vehicleRecord: { select: { numeroEconomico: true } } },
    }),
    prisma.tightnessTestLog.findMany({
      where: { vehicleRecord: vehicleWhere },
      orderBy: { fechaRealizacion: "desc" },
      take: TAKE,
      include: { vehicleRecord: { select: { numeroEconomico: true } } },
    }),
    prisma.internalVisualInspectionLog.findMany({
      where: { vehicleRecord: vehicleWhere },
      orderBy: { fechaRealizacion: "desc" },
      take: TAKE,
      include: { vehicleRecord: { select: { numeroEconomico: true } } },
    }),
    prisma.hydrostaticTestLog.findMany({
      where: { vehicleRecord: vehicleWhere },
      orderBy: { fechaRealizacion: "desc" },
      take: TAKE,
      include: { vehicleRecord: { select: { numeroEconomico: true } } },
    }),
    prisma.extinguisherChangeLog.findMany({
      where: { vehicleRecord: vehicleWhere },
      orderBy: { fechaRealizacion: "desc" },
      take: TAKE,
      include: { vehicleRecord: { select: { numeroEconomico: true } } },
    }),
    prisma.valveChangeLog.findMany({
      where: { vehicleRecord: vehicleWhere },
      orderBy: { fechaInstalacion: "desc" },
      take: TAKE,
      include: { vehicleRecord: { select: { numeroEconomico: true } } },
    }),
    prisma.valveCorrectiveMaintenanceLog.findMany({
      where: { vehicleRecord: vehicleWhere },
      orderBy: { fecha: "desc" },
      take: TAKE,
      include: { vehicleRecord: { select: { numeroEconomico: true } } },
    }),
    prisma.hoseChangeLog.findMany({
      where: { vehicleRecord: vehicleWhere },
      orderBy: { fechaInstalacion: "desc" },
      take: TAKE,
      include: { vehicleRecord: { select: { numeroEconomico: true } } },
    }),
    // "Reactivar" borra fechaBaja (ver actions/vehicle-actions.ts), así que
    // solo las unidades actualmente inactivas tienen un evento de baja que
    // mostrar; no queda historial de reactivaciones pasadas.
    prisma.vehicleRecord.findMany({
      where: { ...vehicleWhere, activo: false, fechaBaja: { not: null } },
      orderBy: { fechaBaja: "desc" },
      take: TAKE,
      select: { id: true, numeroEconomico: true, fechaBaja: true },
    }),
  ]);

  const events: UnitLogEvent[] = [
    ...mantenimiento.map((log) => ({
      id: `mantenimiento-${log.id}`,
      fecha: log.fecha,
      tipo: "Mantenimiento",
      colorKey: "mantenimiento" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      detalle: `${log.tipoMantenimiento} — ${log.tipoServicio} (${maintenanceStatusLabels[log.estatus as MaintenanceStatus] ?? log.estatus})`,
    })),
    ...ultrasonido.map((log) => ({
      id: `ultrasonido-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Ultrasonido",
      colorKey: "ultrasonido" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      detalle: log.numeroUltrasonido ? `No. ${log.numeroUltrasonido}` : "Ultrasonido realizado",
    })),
    ...visualExterna.map((log) => ({
      id: `visual-externa-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Inspección Visual Externa",
      colorKey: "visualExterna" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      detalle: log.numeroInspeccion ? `No. ${log.numeroInspeccion}` : "Inspección realizada",
    })),
    ...hermeticidad.map((log) => ({
      id: `hermeticidad-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Prueba de Hermeticidad",
      colorKey: "hermeticidad" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      detalle: log.numeroPrueba ? `No. ${log.numeroPrueba}` : "Prueba realizada",
    })),
    ...visualInterna.map((log) => ({
      id: `visual-interna-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Inspección Visual Interna",
      colorKey: "visualInterna" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      detalle: log.numeroInspeccion ? `No. ${log.numeroInspeccion}` : "Inspección realizada",
    })),
    ...hidrostatica.map((log) => ({
      id: `hidrostatica-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Prueba Hidrostática",
      colorKey: "hidrostatica" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      detalle: log.numeroPrueba ? `No. ${log.numeroPrueba}` : "Prueba realizada",
    })),
    ...extintor.map((log) => ({
      id: `extintor-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Cambio de Extintor",
      colorKey: "extintor" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      detalle: `Calidad: ${calidadExtintorLabels[log.calidad as CalidadExtintor] ?? log.calidad}`,
    })),
    ...valvulas.map((log) => ({
      id: `valvulas-${log.id}`,
      fecha: log.fechaInstalacion,
      tipo: "Cambio de Válvulas",
      colorKey: "valvulas" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      detalle: "Juego de válvulas instalado",
    })),
    ...valvulasCorrectivo.map((log) => ({
      id: `valvulas-correctivo-${log.id}`,
      fecha: log.fecha,
      tipo: "Mantenimiento correctivo de válvulas",
      colorKey: "valvulas" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      detalle: `${valvulaCorrectivaLabels[log.valvula as ValvulaCorrectiva] ?? log.valvula} — ${log.descripcion}`,
    })),
    ...mangueras.map((log) => ({
      id: `mangueras-${log.id}`,
      fecha: log.fechaInstalacion,
      tipo: "Cambio de Mangueras",
      colorKey: "mangueras" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      detalle: "Manguera instalada",
    })),
    ...bajas.map((v) => ({
      id: `baja-${v.id}`,
      fecha: v.fechaBaja!,
      tipo: "Dado de baja",
      colorKey: "baja" as const,
      vehicleRecordId: v.id,
      numeroEconomico: v.numeroEconomico,
      detalle: "La unidad se dio de baja",
    })),
  ];

  events.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  return events.slice(0, 150);
}
