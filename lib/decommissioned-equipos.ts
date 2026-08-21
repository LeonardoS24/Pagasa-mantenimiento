import { prisma } from "@/lib/prisma";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";

export interface DecommissionedEquipoRow {
  id: string;
  codigo: string | null;
  nombre: string;
  tipoEquipo: string;
  fechaBaja: Date | null;
  motivoBaja: string | null;
  sustituidoPorId: string | null;
  sustituidoPorNombre: string | null;
  estacionNombre: string | null;
  citySlug: string;
  cityName: string;
}

// Equipos dados de baja (reemplazados con un mantenimiento tipo "Cambio"/
// "Reemplazo", o dados de baja directo desde darDeBajaEquipo, ver
// actions/equipment-log-actions.ts y actions/equipo-actions.ts), de TODOS
// los equipos de una ciudad — tanto "Equipos de planta" como los propios de
// cada Estación de carburación (Equipo.vehicleRecordId). La Bitácora de
// equipos (ver isBitacoraEquiposFeed en la página de ciudad) solo mostraba
// el feed de mantenimientos; esto le agrega el rastro de qué equipos ya no
// están en servicio. cityId null = Administración combinando todas las
// ciudades reales, mismo criterio que getCityEquipmentLogFeed.
export async function getDecommissionedEquipos(cityId: string | null): Promise<DecommissionedEquipoRow[]> {
  const equipos = await prisma.equipo.findMany({
    where: {
      activo: false,
      section: cityId ? { cityId } : { city: { slug: { not: AGGREGATE_CITY_SLUG } } },
    },
    orderBy: { fechaBaja: "desc" },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      tipoEquipo: true,
      fechaBaja: true,
      motivoBaja: true,
      sustituidoPorId: true,
      sustituidoPor: { select: { nombre: true, codigo: true } },
      vehicleRecord: { select: { numeroEconomico: true } },
      section: { select: { city: { select: { slug: true, name: true } } } },
    },
  });

  return equipos.map((e) => ({
    id: e.id,
    codigo: e.codigo,
    nombre: e.nombre,
    tipoEquipo: e.tipoEquipo,
    fechaBaja: e.fechaBaja,
    motivoBaja: e.motivoBaja,
    sustituidoPorId: e.sustituidoPorId,
    sustituidoPorNombre: e.sustituidoPor ? e.sustituidoPor.codigo || e.sustituidoPor.nombre : null,
    estacionNombre: e.vehicleRecord?.numeroEconomico ?? null,
    citySlug: e.section.city.slug,
    cityName: e.section.city.name,
  }));
}
