import { prisma } from "@/lib/prisma";
import { getUltrasoundAlertLevel, daysUntil } from "@/lib/ultrasound-alerts";
import { getVisualInspectionAlertLevel } from "@/lib/visual-inspection-alerts";
import { getTightnessTestAlertLevel } from "@/lib/tightness-test-alerts";
import { getInternalVisualInspectionAlertLevel } from "@/lib/internal-visual-inspection-alerts";
import { getHydrostaticTestAlertLevel } from "@/lib/hydrostatic-test-alerts";
import { getExtinguisherAlertLevel } from "@/lib/extinguisher-alerts";
import { getMaintenanceAlertLevel } from "@/lib/maintenance-alerts";
import { getValveAlertLevel, getValveVencimiento, oldestValve } from "@/lib/valve-alerts";
import { getHoseAlertLevel, getHoseVencimiento } from "@/lib/hose-alerts";
import { isAlertVisibleForSection } from "@/lib/alert-visibility";

// Reúne las 9 alertas de vencimiento (ultrasonido, visual externa,
// hermeticidad, visual interna, hidrostática, extintor, mantenimiento,
// válvulas, mangueras) para un conjunto de ciudades. Usada tanto por Inicio
// (solo las ciudades del usuario) como por el panel de alertas de
// Administración (todas las ciudades, ver app/(protected)/admin/alertas/page.tsx)
// para no duplicar esta lógica en dos lugares.
export async function getAllVehicleAlerts(cityIds: string[]) {
  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const upcomingRecords = await prisma.vehicleRecord.findMany({
    where: {
      activo: true,
      section: { cityId: { in: cityIds } },
      technicalSheet: {
        OR: [
          { fechaProximoUltrasonido: { lte: soon } },
          { fechaProximaInspeccionVisual: { lte: soon } },
          { fechaProximaPruebaHermeticidad: { lte: soon } },
          { fechaProximaInspeccionVisualInterna: { lte: soon } },
          { fechaProximaPruebaHidrostatica: { lte: soon } },
          { calidadExtintor: "MALA" },
          { fechaProximoMantenimiento: { lte: soon } },
          { fechaFabricacionValvulaLlenado: { not: null } },
          { fechaFabricacionValvulaNoRetroceso: { not: null } },
          { fechaFabricacionValvulaBypass: { not: null } },
          { fechaFabricacionValvulaRetornoVapores: { not: null } },
          { fechaFabricacionValvulaServicio: { not: null } },
          { fechaFabricacionValvulaMaximoLlenado: { not: null } },
          { fechaFabricacionValvulaMaximoLlenado85: { not: null } },
          { fechaFabricacionValvulaAlivio: { not: null } },
          { fechaFabricacionValvulaDescargaEmergencia: { not: null } },
          { fechaFabricacionManguera: { not: null } },
        ],
      },
    },
    include: { technicalSheet: true, section: { include: { city: true } } },
  });

  const alertVehicles = upcomingRecords
    .map((record) => {
      if (!isAlertVisibleForSection("ultrasonido", record.section.slug)) return null;
      const fecha = record.technicalSheet?.fechaProximoUltrasonido;
      if (!fecha) return null;
      const level = getUltrasoundAlertLevel(fecha);
      if (level === "none") return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        fechaProximoUltrasonido: fecha,
        level,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => daysUntil(a.fechaProximoUltrasonido) - daysUntil(b.fechaProximoUltrasonido));

  const visualAlertVehicles = upcomingRecords
    .map((record) => {
      if (!isAlertVisibleForSection("visualExterna", record.section.slug)) return null;
      const fecha = record.technicalSheet?.fechaProximaInspeccionVisual;
      if (!fecha) return null;
      const level = getVisualInspectionAlertLevel(fecha);
      if (level === "none") return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        fechaProximaInspeccionVisual: fecha,
        level,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => daysUntil(a.fechaProximaInspeccionVisual) - daysUntil(b.fechaProximaInspeccionVisual));

  const tightnessAlertVehicles = upcomingRecords
    .map((record) => {
      if (!isAlertVisibleForSection("hermeticidad", record.section.slug)) return null;
      const fecha = record.technicalSheet?.fechaProximaPruebaHermeticidad;
      if (!fecha) return null;
      const level = getTightnessTestAlertLevel(fecha);
      if (level === "none") return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        fechaProximaPruebaHermeticidad: fecha,
        level,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort(
      (a, b) => daysUntil(a.fechaProximaPruebaHermeticidad) - daysUntil(b.fechaProximaPruebaHermeticidad)
    );

  const internalVisualAlertVehicles = upcomingRecords
    .map((record) => {
      if (!isAlertVisibleForSection("visualInterna", record.section.slug)) return null;
      const fecha = record.technicalSheet?.fechaProximaInspeccionVisualInterna;
      if (!fecha) return null;
      const level = getInternalVisualInspectionAlertLevel(fecha);
      if (level === "none") return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        fechaProximaInspeccionVisualInterna: fecha,
        level,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort(
      (a, b) =>
        daysUntil(a.fechaProximaInspeccionVisualInterna) -
        daysUntil(b.fechaProximaInspeccionVisualInterna)
    );

  const hydrostaticAlertVehicles = upcomingRecords
    .map((record) => {
      if (!isAlertVisibleForSection("hidrostatica", record.section.slug)) return null;
      const fecha = record.technicalSheet?.fechaProximaPruebaHidrostatica;
      if (!fecha) return null;
      const level = getHydrostaticTestAlertLevel(fecha);
      if (level === "none") return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        fechaProximaPruebaHidrostatica: fecha,
        level,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort(
      (a, b) => daysUntil(a.fechaProximaPruebaHidrostatica) - daysUntil(b.fechaProximaPruebaHidrostatica)
    );

  const extinguisherAlertVehicles = upcomingRecords
    .map((record) => {
      if (!isAlertVisibleForSection("extintor", record.section.slug)) return null;
      const level = getExtinguisherAlertLevel(
        record.technicalSheet?.calidadExtintor,
        record.technicalSheet?.fechaCalidadMalaExtintor
      );
      if (level === "none") return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        fechaCalidadMalaExtintor: record.technicalSheet?.fechaCalidadMalaExtintor ?? null,
        level,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => {
      const aTime = a.fechaCalidadMalaExtintor?.getTime() ?? Date.now();
      const bTime = b.fechaCalidadMalaExtintor?.getTime() ?? Date.now();
      return aTime - bTime;
    });

  const maintenanceAlertVehicles = upcomingRecords
    .map((record) => {
      if (!isAlertVisibleForSection("mantenimiento", record.section.slug)) return null;
      const fecha = record.technicalSheet?.fechaProximoMantenimiento;
      if (!fecha) return null;
      const level = getMaintenanceAlertLevel(fecha);
      if (level === "none") return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        fechaProximoMantenimiento: fecha,
        kilometrajeProximoMantenimiento: record.technicalSheet?.kilometrajeProximoMantenimiento ?? null,
        level,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => daysUntil(a.fechaProximoMantenimiento) - daysUntil(b.fechaProximoMantenimiento));

  const valveAlertVehicles = upcomingRecords
    .map((record) => {
      if (!isAlertVisibleForSection("valvulas", record.section.slug)) return null;
      const dates = {
        fechaFabricacionValvulaLlenado: record.technicalSheet?.fechaFabricacionValvulaLlenado,
        fechaFabricacionValvulaNoRetroceso: record.technicalSheet?.fechaFabricacionValvulaNoRetroceso,
        fechaFabricacionValvulaBypass: record.technicalSheet?.fechaFabricacionValvulaBypass,
        fechaFabricacionValvulaRetornoVapores:
          record.technicalSheet?.fechaFabricacionValvulaRetornoVapores,
        fechaFabricacionValvulaServicio: record.technicalSheet?.fechaFabricacionValvulaServicio,
        fechaFabricacionValvulaMaximoLlenado:
          record.technicalSheet?.fechaFabricacionValvulaMaximoLlenado,
        fechaFabricacionValvulaMaximoLlenado85:
          record.technicalSheet?.fechaFabricacionValvulaMaximoLlenado85,
        fechaFabricacionValvulaAlivio: record.technicalSheet?.fechaFabricacionValvulaAlivio,
        fechaFabricacionValvulaDescargaEmergencia:
          record.technicalSheet?.fechaFabricacionValvulaDescargaEmergencia,
      };
      const level = getValveAlertLevel(dates);
      if (level === "none") return null;
      const vencimiento = getValveVencimiento(dates);
      if (!vencimiento) return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        vencimiento,
        valvulaMasAntigua: oldestValve(dates)?.key,
        level,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => daysUntil(a.vencimiento) - daysUntil(b.vencimiento));

  const hoseAlertVehicles = upcomingRecords
    .map((record) => {
      if (!isAlertVisibleForSection("mangueras", record.section.slug)) return null;
      const level = getHoseAlertLevel(record.technicalSheet?.fechaFabricacionManguera);
      if (level === "none") return null;
      const vencimiento = getHoseVencimiento(record.technicalSheet?.fechaFabricacionManguera);
      if (!vencimiento) return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        vencimiento,
        level,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => daysUntil(a.vencimiento) - daysUntil(b.vencimiento));

  return {
    alertVehicles,
    visualAlertVehicles,
    tightnessAlertVehicles,
    internalVisualAlertVehicles,
    hydrostaticAlertVehicles,
    extinguisherAlertVehicles,
    maintenanceAlertVehicles,
    valveAlertVehicles,
    hoseAlertVehicles,
  };
}
