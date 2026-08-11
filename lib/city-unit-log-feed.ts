import { prisma } from "@/lib/prisma";
import type { BadgeColorKey } from "@/lib/section-colors";
import { maintenanceStatusLabels, calidadExtintorLabels, type MaintenanceStatus, type CalidadExtintor } from "@/lib/vehicle-enums";
import { valvulaCorrectivaLabels, type ValvulaCorrectiva } from "@/lib/valve-alerts";
import type { MonthRange } from "@/lib/piece-maintenance-stats";

export interface UnitLogEvent {
  id: string;
  fecha: Date;
  tipo: string;
  colorKey: BadgeColorKey;
  vehicleRecordId: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  detalle: string;
  // Solo en eventos "Dado de baja" de una unidad que estaba repetida en más
  // de un apartado (ver groupBajas más abajo): el link va a la hoja
  // combinada (/imprimir) en vez de a un solo apartado, ya que ahí es donde
  // se ve la unidad completa en un solo formato.
  isMerged?: boolean;
}

const TAKE = 100;
// Cuando se pide un mes específico (Administración, ver lib/dates.ts:
// getMonthRange), no tiene sentido truncar a los últimos N: hay que ver
// TODO lo que pasó ese mes. 2000 es solo un tope de seguridad.
const TAKE_RANGE = 2000;
const cityInclude = { section: { select: { city: { select: { slug: true, name: true } } } } } as const;

function dateFilter(range: MonthRange | undefined) {
  return range ? { gte: range.start, lt: range.end } : undefined;
}

// Agrupa por ciudad+número económico: el mismo camión físico puede tener un
// VehicleRecord en Auto-Tanques y otro en Vehículo con tanque de
// carburación (ver comentario donde se usa, más abajo). Cada grupo trae
// todos los registros pareados, para poder decir en qué apartados estaba en
// vez de solo quedarse con el primero y perder esa información.
function groupBajas<
  T extends { numeroEconomico: string; section: { name: string; city: { slug: string } } },
>(bajas: T[]): T[][] {
  const groups = new Map<string, T[]>();
  for (const v of bajas) {
    const key = `${v.section.city.slug}::${v.numeroEconomico}`;
    const group = groups.get(key);
    if (group) group.push(v);
    else groups.set(key, [v]);
  }
  return Array.from(groups.values());
}

// Reúne los 10 tipos de bitácora de una unidad más el evento "Dado de baja"
// en un solo feed cronológico a nivel ciudad. Cada tipo vive en su propio
// modelo (ver prisma/schema.prisma), así que se consultan por separado y se
// combinan en memoria — no hay forma de hacer esto en una sola consulta SQL
// porque son tablas distintas sin una columna de tipo compartida.
// cityId null = todas las ciudades combinadas (ver el apartado
// "Administración", lib/aggregate-city.ts); cada evento lleva su propia
// ciudad para que el link a la unidad y la etiqueta salgan correctos ahí.
// range opcional: sin él, se muestran los últimos eventos sin importar
// cuándo pasaron (comportamiento de siempre). Con él (selector de mes de
// Administración), se muestra TODO lo que cayó en ese mes, sin truncar a
// los más recientes.
export async function getCityUnitLogFeed(
  cityId: string | null,
  range?: MonthRange
): Promise<UnitLogEvent[]> {
  const vehicleWhere = cityId ? { section: { cityId } } : {};
  const take = range ? TAKE_RANGE : TAKE;

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
      where: { vehicleRecord: vehicleWhere, fecha: dateFilter(range) },
      orderBy: { fecha: "desc" },
      take,
      include: { vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.ultrasoundLog.findMany({
      where: { vehicleRecord: vehicleWhere, fechaRealizacion: dateFilter(range) },
      orderBy: { fechaRealizacion: "desc" },
      take,
      include: { vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.visualInspectionLog.findMany({
      where: { vehicleRecord: vehicleWhere, fechaRealizacion: dateFilter(range) },
      orderBy: { fechaRealizacion: "desc" },
      take,
      include: { vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.tightnessTestLog.findMany({
      where: { vehicleRecord: vehicleWhere, fechaRealizacion: dateFilter(range) },
      orderBy: { fechaRealizacion: "desc" },
      take,
      include: { vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.internalVisualInspectionLog.findMany({
      where: { vehicleRecord: vehicleWhere, fechaRealizacion: dateFilter(range) },
      orderBy: { fechaRealizacion: "desc" },
      take,
      include: { vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.hydrostaticTestLog.findMany({
      where: { vehicleRecord: vehicleWhere, fechaRealizacion: dateFilter(range) },
      orderBy: { fechaRealizacion: "desc" },
      take,
      include: { vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.extinguisherChangeLog.findMany({
      where: { vehicleRecord: vehicleWhere, fechaRealizacion: dateFilter(range) },
      orderBy: { fechaRealizacion: "desc" },
      take,
      include: { vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.valveChangeLog.findMany({
      where: { vehicleRecord: vehicleWhere, fechaInstalacion: dateFilter(range) },
      orderBy: { fechaInstalacion: "desc" },
      take,
      include: { vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.valveCorrectiveMaintenanceLog.findMany({
      where: { vehicleRecord: vehicleWhere, fecha: dateFilter(range) },
      orderBy: { fecha: "desc" },
      take,
      include: { vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    prisma.hoseChangeLog.findMany({
      where: { vehicleRecord: vehicleWhere, fechaInstalacion: dateFilter(range) },
      orderBy: { fechaInstalacion: "desc" },
      take,
      include: { vehicleRecord: { select: { numeroEconomico: true, ...cityInclude } } },
    }),
    // "Reactivar" borra fechaBaja (ver actions/vehicle-actions.ts), así que
    // solo las unidades actualmente inactivas tienen un evento de baja que
    // mostrar; no queda historial de reactivaciones pasadas.
    prisma.vehicleRecord.findMany({
      where: {
        ...vehicleWhere,
        activo: false,
        fechaBaja: range ? { not: null, gte: range.start, lt: range.end } : { not: null },
      },
      orderBy: { fechaBaja: "desc" },
      take,
      select: {
        id: true,
        numeroEconomico: true,
        fechaBaja: true,
        motivoBaja: true,
        section: { select: { slug: true, name: true, city: { select: { slug: true, name: true } } } },
      },
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
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      detalle: `${log.tipoMantenimiento} — ${log.tipoServicio} (${maintenanceStatusLabels[log.estatus as MaintenanceStatus] ?? log.estatus})`,
    })),
    ...ultrasonido.map((log) => ({
      id: `ultrasonido-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Ultrasonido",
      colorKey: "ultrasonido" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      detalle: log.numeroUltrasonido ? `No. ${log.numeroUltrasonido}` : "Ultrasonido realizado",
    })),
    ...visualExterna.map((log) => ({
      id: `visual-externa-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Inspección Visual Externa",
      colorKey: "visualExterna" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      detalle: log.numeroInspeccion ? `No. ${log.numeroInspeccion}` : "Inspección realizada",
    })),
    ...hermeticidad.map((log) => ({
      id: `hermeticidad-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Prueba de Hermeticidad",
      colorKey: "hermeticidad" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      detalle: log.numeroPrueba ? `No. ${log.numeroPrueba}` : "Prueba realizada",
    })),
    ...visualInterna.map((log) => ({
      id: `visual-interna-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Inspección Visual Interna",
      colorKey: "visualInterna" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      detalle: log.numeroInspeccion ? `No. ${log.numeroInspeccion}` : "Inspección realizada",
    })),
    ...hidrostatica.map((log) => ({
      id: `hidrostatica-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Prueba Hidrostática",
      colorKey: "hidrostatica" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      detalle: log.numeroPrueba ? `No. ${log.numeroPrueba}` : "Prueba realizada",
    })),
    ...extintor.map((log) => ({
      id: `extintor-${log.id}`,
      fecha: log.fechaRealizacion,
      tipo: "Cambio de Extintor",
      colorKey: "extintor" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      detalle: `Calidad: ${calidadExtintorLabels[log.calidad as CalidadExtintor] ?? log.calidad}`,
    })),
    ...valvulas.map((log) => ({
      id: `valvulas-${log.id}`,
      fecha: log.fechaInstalacion,
      tipo: "Cambio de Válvulas",
      colorKey: "valvulas" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      detalle: "Juego de válvulas instalado",
    })),
    ...valvulasCorrectivo.map((log) => ({
      id: `valvulas-correctivo-${log.id}`,
      fecha: log.fecha,
      tipo: "Mantenimiento correctivo de válvulas",
      colorKey: "valvulas" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      detalle: `${valvulaCorrectivaLabels[log.valvula as ValvulaCorrectiva] ?? log.valvula} — ${log.descripcion}`,
    })),
    ...mangueras.map((log) => ({
      id: `mangueras-${log.id}`,
      fecha: log.fechaInstalacion,
      tipo: "Cambio de Mangueras",
      colorKey: "mangueras" as const,
      vehicleRecordId: log.vehicleRecordId,
      numeroEconomico: log.vehicleRecord.numeroEconomico,
      citySlug: log.vehicleRecord.section.city.slug,
      cityName: log.vehicleRecord.section.city.name,
      detalle: "Manguera instalada",
    })),
    // Auto-Tanques y Vehículo con tanque de carburación pueden repetir el
    // mismo número económico como el mismo camión físico en dos apartados
    // (ver setVehicleActive en actions/vehicle-actions.ts, que da de baja a
    // ambos registros a la vez). Para el feed es la misma unidad, así que
    // solo debe aparecer un evento "Dado de baja" por ciudad+número
    // económico, no uno por cada registro — y ese evento menciona en qué
    // apartados estaba, igual que se ve todo junto al imprimir la hoja de la
    // unidad (ver unitLogEventHref: el link va a /imprimir, no a un solo
    // apartado).
    ...groupBajas(bajas).map((group) => {
      const [primary, ...resto] = group;
      const apartados = group.map((v) => v.section.name).join(" + ");
      const motivo = group.find((v) => v.motivoBaja)?.motivoBaja;
      let detalle = resto.length > 0 ? `La unidad se dio de baja (${apartados})` : "La unidad se dio de baja";
      if (motivo) detalle += ` — Motivo: ${motivo}`;
      return {
        id: `baja-${primary.id}`,
        fecha: primary.fechaBaja!,
        tipo: "Dado de baja",
        colorKey: "baja" as const,
        vehicleRecordId: primary.id,
        numeroEconomico: primary.numeroEconomico,
        citySlug: primary.section.city.slug,
        cityName: primary.section.city.name,
        detalle,
        isMerged: resto.length > 0,
      };
    }),
  ];

  events.sort((a, b) => b.fecha.getTime() - a.fecha.getTime());
  // Sin range: mantiene el tope corto de "actividad reciente" de siempre.
  // Con range: ya viene acotado por mes en cada consulta, se muestra todo.
  return range ? events : events.slice(0, 150);
}

// Prefijos usados arriba para armar UnitLogEvent.id (`${prefijo}-${log.id}`),
// del más largo al más corto para que un prefijo que es substring de otro
// (p.ej. "valvulas" dentro de "valvulas-correctivo") no se confunda al
// buscarlo con startsWith.
const EVENT_PREFIXES = [
  "valvulas-correctivo",
  "visual-externa",
  "visual-interna",
  "hidrostatica",
  "hermeticidad",
  "mantenimiento",
  "ultrasonido",
  "extintor",
  "valvulas",
  "mangueras",
  "baja",
] as const;

// A dónde debe llevar el link de un evento del feed: los de tipo
// "Mantenimiento" llegan directo a su registro ya expandido y resaltado (ver
// ?mantenimiento= en components/city/MaintenanceLogRow.tsx); los otros 9
// tipos no tienen ese mecanismo por registro individual, así que llegan al
// ancla de su propia sección en la página de la unidad (ver los id= en
// app/(protected)/ciudades/[citySlug]/vehiculo/[vehicleId]/page.tsx) en vez
// de mandar siempre a la parte superior de la página.
export function unitLogEventHref(event: UnitLogEvent): string {
  const base = `/ciudades/${event.citySlug}/vehiculo/${event.vehicleRecordId}`;
  if (event.isMerged) return `${base}/imprimir`;
  const prefix = EVENT_PREFIXES.find((p) => event.id.startsWith(`${p}-`));
  if (!prefix) return base;
  if (prefix === "mantenimiento") {
    const rawId = event.id.slice("mantenimiento-".length);
    return `${base}?mantenimiento=${rawId}`;
  }
  return `${base}#${prefix}`;
}
