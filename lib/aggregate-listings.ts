import { prisma } from "@/lib/prisma";
import { AGGREGATE_CITY_SLUG } from "@/lib/aggregate-city";
import { getVehicleSemaforoLevel, type SemaforoLevel } from "@/lib/vehicle-semaforo";

export interface AggregateVehicleRow {
  id: string;
  numeroEconomico: string;
  sucursal: string;
  // Vacíos en "Estaciones de carburación" (no son vehículos, ver
  // scripts/add-estaciones-de-carburacion.mjs y components/admin/VehicleForm.tsx).
  anio: string | null;
  placas: string | null;
  serie: string | null;
  // Solo en "Estaciones de carburación" (ver components/admin/VehicleForm.tsx).
  permisionaria: string | null;
  permiso: string | null;
  activo: boolean;
  motivoBaja: string | null;
  estatus: string;
  citySlug: string;
  cityName: string;
  semaforoLevel: SemaforoLevel;
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
      permisionaria: true,
      permiso: true,
      activo: true,
      motivoBaja: true,
      estatus: true,
      technicalSheet: true,
      stationTankTechnicalSheets: true,
      section: { select: { slug: true, city: { select: { slug: true, name: true, order: true } } } },
    },
  });

  return records
    .map((r) => ({
      id: r.id,
      numeroEconomico: r.numeroEconomico,
      sucursal: r.sucursal,
      anio: r.anio,
      placas: r.placas,
      serie: r.stationTankTechnicalSheets[0]?.numeroSerie ?? r.technicalSheet?.serie ?? null,
      permisionaria: r.permisionaria,
      permiso: r.permiso,
      activo: r.activo,
      motivoBaja: r.motivoBaja,
      estatus: r.estatus,
      citySlug: r.section.city.slug,
      cityName: r.section.city.name,
      cityOrder: r.section.city.order,
      semaforoLevel: r.activo
        ? getVehicleSemaforoLevel(r.technicalSheet, r.section.slug, r.stationTankTechnicalSheets)
        : ("none" as const),
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
  numeroSerie: string | null;
  tipoEquipo: string;
  activo: boolean;
  criticidad: string | null;
  citySlug: string;
  cityName: string;
}

// Todos los equipos de todas las ciudades reales, para el mismo listado
// combinado de Administración.
export async function getAggregateEquipos(): Promise<AggregateEquipoRow[]> {
  const equipos = await prisma.equipo.findMany({
    where: {
      section: { slug: "equipos", city: { slug: { not: AGGREGATE_CITY_SLUG } } },
      // Excluye los equipos propios de una Estación de carburación en
      // particular (ver Equipo.vehicleRecordId): esos no son "Equipos de
      // planta", se ven en la propia unidad.
      vehicleRecordId: null,
    },
    select: {
      id: true,
      codigo: true,
      nombre: true,
      numeroSerie: true,
      tipoEquipo: true,
      activo: true,
      criticidad: true,
      section: { select: { city: { select: { slug: true, name: true, order: true } } } },
    },
  });

  return equipos
    .map((e) => ({
      id: e.id,
      codigo: e.codigo,
      nombre: e.nombre,
      numeroSerie: e.numeroSerie,
      tipoEquipo: e.tipoEquipo,
      activo: e.activo,
      criticidad: e.criticidad,
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

// Equipos activos de criticidad ALTA de todas las ciudades reales, sin
// importar si ya tienen mantenimiento registrado (a diferencia de
// CityEquipmentLogFeed, que solo muestra equipos con bitácora): para que
// Administración no pierda de vista un equipo crítico que todavía no se ha
// tocado.
export async function getHighCriticidadEquipos(): Promise<AggregateEquipoRow[]> {
  const equipos = await getAggregateEquipos();
  return equipos.filter((e) => e.activo && e.criticidad === "ALTA");
}

export interface VehicleInMaintenanceRow {
  id: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  sectionName: string;
}

// Todas las unidades activas en estatus EN_TALLER, de cualquier ciudad y
// cualquier tipo de apartado (a diferencia de getAggregateVehicleRecords, que
// acota a un solo sectionSlug): para el panel de Administración (ver
// VehiclesInMaintenancePanel.tsx) con el botón de "Marcar operativa" a la
// mano, mismo criterio que HighCriticidadEquiposPanel de que nunca pase
// desapercibido. No incluye Estaciones/Planta (no aplican a "en taller").
export async function getVehiclesInMaintenance(): Promise<VehicleInMaintenanceRow[]> {
  const records = await prisma.vehicleRecord.findMany({
    where: {
      activo: true,
      estatus: "EN_TALLER",
      section: {
        city: { slug: { not: AGGREGATE_CITY_SLUG } },
        slug: { notIn: ["estaciones-de-carburacion", "planta-ficha-tecnica"] },
      },
    },
    select: {
      id: true,
      numeroEconomico: true,
      section: { select: { name: true, city: { select: { slug: true, name: true, order: true } } } },
    },
  });

  return records
    .map((r) => ({
      id: r.id,
      numeroEconomico: r.numeroEconomico,
      citySlug: r.section.city.slug,
      cityName: r.section.city.name,
      sectionName: r.section.name,
      cityOrder: r.section.city.order,
    }))
    .sort((a, b) => a.cityOrder - b.cityOrder || a.numeroEconomico.localeCompare(b.numeroEconomico));
}
