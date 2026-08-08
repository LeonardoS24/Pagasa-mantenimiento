import { prisma } from "@/lib/prisma";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";

export interface AggregateVehicleRow {
  id: string;
  numeroEconomico: string;
  sucursal: string;
  anio: string;
  placas: string;
  activo: boolean;
  citySlug: string;
  cityName: string;
}

// Todas las unidades de todas las ciudades reales cuyo apartado (dentro de
// "Unidad de distribución") tiene este mismo slug (p.ej. "auto-tanques"),
// para el listado combinado de Administración (ver lib/aggregate-city.ts):
// "todas las unidades... agregadas en administración todas juntas...
// diciendo de dónde es".
export async function getAggregateVehicleRecords(sectionSlug: string): Promise<AggregateVehicleRow[]> {
  const records = await prisma.vehicleRecord.findMany({
    where: { section: { slug: sectionSlug, city: { slug: { not: AGGREGATE_CITY_SLUG } } } },
    select: {
      id: true,
      numeroEconomico: true,
      sucursal: true,
      anio: true,
      placas: true,
      activo: true,
      section: { select: { city: { select: { slug: true, name: true, order: true } } } },
    },
  });

  return records
    .map((r) => ({
      id: r.id,
      numeroEconomico: r.numeroEconomico,
      sucursal: r.sucursal,
      anio: r.anio,
      placas: r.placas,
      activo: r.activo,
      citySlug: r.section.city.slug,
      cityName: r.section.city.name,
      cityOrder: r.section.city.order,
    }))
    .sort((a, b) => {
      if (a.activo !== b.activo) return a.activo ? -1 : 1;
      if (a.cityOrder !== b.cityOrder) return a.cityOrder - b.cityOrder;
      return a.numeroEconomico.localeCompare(b.numeroEconomico);
    });
}

export interface AggregateEquipoRow {
  id: string;
  codigo: string | null;
  nombre: string;
  tipoEquipo: string;
  activo: boolean;
  citySlug: string;
  cityName: string;
}

// Todos los equipos de todas las ciudades reales, para el mismo listado
// combinado de Administración.
export async function getAggregateEquipos(): Promise<AggregateEquipoRow[]> {
  const equipos = await prisma.equipo.findMany({
    where: { section: { slug: "equipos", city: { slug: { not: AGGREGATE_CITY_SLUG } } } },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      tipoEquipo: true,
      activo: true,
      section: { select: { city: { select: { slug: true, name: true, order: true } } } },
    },
  });

  return equipos
    .map((e) => ({
      id: e.id,
      codigo: e.codigo,
      nombre: e.nombre,
      tipoEquipo: e.tipoEquipo,
      activo: e.activo,
      citySlug: e.section.city.slug,
      cityName: e.section.city.name,
      cityOrder: e.section.city.order,
    }))
    .sort((a, b) => {
      if (a.activo !== b.activo) return a.activo ? -1 : 1;
      if (a.cityOrder !== b.cityOrder) return a.cityOrder - b.cityOrder;
      return a.nombre.localeCompare(b.nombre);
    });
}
