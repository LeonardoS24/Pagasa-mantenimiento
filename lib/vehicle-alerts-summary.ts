import { prisma } from "@/lib/prisma";
import { getUltrasoundAlertLevel, daysUntil } from "@/lib/ultrasound-alerts";
import { getVisualInspectionAlertLevel } from "@/lib/visual-inspection-alerts";
import { getTightnessTestAlertLevel } from "@/lib/tightness-test-alerts";
import { getInternalVisualInspectionAlertLevel } from "@/lib/internal-visual-inspection-alerts";
import { getHydrostaticTestAlertLevel } from "@/lib/hydrostatic-test-alerts";
import { getExtinguisherAlertLevel } from "@/lib/extinguisher-alerts";
import { getMaintenanceAlertLevel } from "@/lib/maintenance-alerts";
import { getValveAlertLevel, getValveVencimiento, oldestValve, valveDatesFromSheet } from "@/lib/valve-alerts";
import { getHoseAlertLevel, getHoseVencimiento } from "@/lib/hose-alerts";
import { isAlertVisibleForSection } from "@/lib/alert-visibility";
import { getInsuranceAlertLevel } from "@/lib/insurance-alerts";
import { getStationValveAlertLevel, getStationValveVencimiento, oldestStationValve } from "@/lib/station-valves";
import {
  PLANTA_INSTRUMENT_FIELDS,
  getPlantaInstrumentVencimiento,
  getPlantaInstrumentAlertLevel,
} from "@/lib/planta-tank-instruments";
import { ESTACION_LIKE_SECTION_SLUGS } from "@/lib/estacion-sections";

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
          { fechaFabricacionValvulaExcesoFlujo: { not: null } },
          { fechaFabricacionValvulaCheckLock: { not: null } },
          { fechaFabricacionManguera: { not: null } },
        ],
      },
    },
    include: { technicalSheet: true, section: { include: { city: true } } },
  });

  // Estaciones/planta con más de un tanque físico: desde que cada tanque
  // lleva su propio ciclo de las 5 pruebas periódicas (ver
  // StationTankTechnicalSheet en el schema), la ficha compartida del
  // registro ya no se actualiza para ellas — sus alertas de estos 5 tipos
  // salen una por tanque más abajo, no a nivel de todo el registro.
  const stationRecords = await prisma.vehicleRecord.findMany({
    where: {
      activo: true,
      section: { cityId: { in: cityIds }, slug: { in: ESTACION_LIKE_SECTION_SLUGS } },
    },
    include: {
      stationTankTechnicalSheets: true,
      section: { include: { city: true } },
    },
  });
  const multiTanqueIds = new Set(
    stationRecords.filter((r) => r.stationTankTechnicalSheets.length > 1).map((r) => r.id)
  );

  const alertVehicles = [
    ...upcomingRecords
      .map((record) => {
        if (multiTanqueIds.has(record.id)) return null;
        if (!isAlertVisibleForSection("ultrasonido", record.section.slug)) return null;
        const fecha = record.technicalSheet?.fechaProximoUltrasonido;
        if (!fecha) return null;
        const level = getUltrasoundAlertLevel(fecha);
        if (level === "none") return null;
        return {
          id: record.id,
          numeroEconomico: record.numeroEconomico,
          sectionSlug: record.section.slug,
          citySlug: record.section.city.slug,
          cityName: record.section.city.name,
          fechaProximoUltrasonido: fecha,
          etiquetaTanque: undefined as string | undefined,
          level,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
    ...stationRecords
      .filter((record) => multiTanqueIds.has(record.id))
      .flatMap((record) => {
        if (!isAlertVisibleForSection("ultrasonido", record.section.slug)) return [];
        return record.stationTankTechnicalSheets.map((tanque) => {
          const fecha = tanque.fechaProximoUltrasonido;
          if (!fecha) return null;
          const level = getUltrasoundAlertLevel(fecha);
          if (level === "none") return null;
          return {
            id: record.id,
            numeroEconomico: record.numeroEconomico,
            sectionSlug: record.section.slug,
            citySlug: record.section.city.slug,
            cityName: record.section.city.name,
            fechaProximoUltrasonido: fecha,
            etiquetaTanque: tanque.etiqueta as string | undefined,
            level,
          };
        });
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
  ].sort((a, b) => daysUntil(a.fechaProximoUltrasonido) - daysUntil(b.fechaProximoUltrasonido));

  const visualAlertVehicles = [
    ...upcomingRecords
      .map((record) => {
        if (multiTanqueIds.has(record.id)) return null;
        if (!isAlertVisibleForSection("visualExterna", record.section.slug)) return null;
        const fecha = record.technicalSheet?.fechaProximaInspeccionVisual;
        if (!fecha) return null;
        const level = getVisualInspectionAlertLevel(fecha);
        if (level === "none") return null;
        return {
          id: record.id,
          numeroEconomico: record.numeroEconomico,
          sectionSlug: record.section.slug,
          citySlug: record.section.city.slug,
          cityName: record.section.city.name,
          fechaProximaInspeccionVisual: fecha,
          etiquetaTanque: undefined as string | undefined,
          level,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
    ...stationRecords
      .filter((record) => multiTanqueIds.has(record.id))
      .flatMap((record) => {
        if (!isAlertVisibleForSection("visualExterna", record.section.slug)) return [];
        return record.stationTankTechnicalSheets.map((tanque) => {
          const fecha = tanque.fechaProximaInspeccionVisual;
          if (!fecha) return null;
          const level = getVisualInspectionAlertLevel(fecha);
          if (level === "none") return null;
          return {
            id: record.id,
            numeroEconomico: record.numeroEconomico,
            sectionSlug: record.section.slug,
            citySlug: record.section.city.slug,
            cityName: record.section.city.name,
            fechaProximaInspeccionVisual: fecha,
            etiquetaTanque: tanque.etiqueta as string | undefined,
            level,
          };
        });
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
  ].sort((a, b) => daysUntil(a.fechaProximaInspeccionVisual) - daysUntil(b.fechaProximaInspeccionVisual));

  const tightnessAlertVehicles = [
    ...upcomingRecords
      .map((record) => {
        if (multiTanqueIds.has(record.id)) return null;
        if (!isAlertVisibleForSection("hermeticidad", record.section.slug)) return null;
        const fecha = record.technicalSheet?.fechaProximaPruebaHermeticidad;
        if (!fecha) return null;
        const level = getTightnessTestAlertLevel(fecha);
        if (level === "none") return null;
        return {
          id: record.id,
          numeroEconomico: record.numeroEconomico,
          sectionSlug: record.section.slug,
          citySlug: record.section.city.slug,
          cityName: record.section.city.name,
          fechaProximaPruebaHermeticidad: fecha,
          etiquetaTanque: undefined as string | undefined,
          level,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
    ...stationRecords
      .filter((record) => multiTanqueIds.has(record.id))
      .flatMap((record) => {
        if (!isAlertVisibleForSection("hermeticidad", record.section.slug)) return [];
        return record.stationTankTechnicalSheets.map((tanque) => {
          const fecha = tanque.fechaProximaPruebaHermeticidad;
          if (!fecha) return null;
          const level = getTightnessTestAlertLevel(fecha);
          if (level === "none") return null;
          return {
            id: record.id,
            numeroEconomico: record.numeroEconomico,
            sectionSlug: record.section.slug,
            citySlug: record.section.city.slug,
            cityName: record.section.city.name,
            fechaProximaPruebaHermeticidad: fecha,
            etiquetaTanque: tanque.etiqueta as string | undefined,
            level,
          };
        });
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
  ].sort(
    (a, b) => daysUntil(a.fechaProximaPruebaHermeticidad) - daysUntil(b.fechaProximaPruebaHermeticidad)
  );

  const internalVisualAlertVehicles = [
    ...upcomingRecords
      .map((record) => {
        if (multiTanqueIds.has(record.id)) return null;
        if (!isAlertVisibleForSection("visualInterna", record.section.slug)) return null;
        const fecha = record.technicalSheet?.fechaProximaInspeccionVisualInterna;
        if (!fecha) return null;
        const level = getInternalVisualInspectionAlertLevel(fecha);
        if (level === "none") return null;
        return {
          id: record.id,
          numeroEconomico: record.numeroEconomico,
          sectionSlug: record.section.slug,
          citySlug: record.section.city.slug,
          cityName: record.section.city.name,
          fechaProximaInspeccionVisualInterna: fecha,
          etiquetaTanque: undefined as string | undefined,
          level,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
    ...stationRecords
      .filter((record) => multiTanqueIds.has(record.id))
      .flatMap((record) => {
        if (!isAlertVisibleForSection("visualInterna", record.section.slug)) return [];
        return record.stationTankTechnicalSheets.map((tanque) => {
          const fecha = tanque.fechaProximaInspeccionVisualInterna;
          if (!fecha) return null;
          const level = getInternalVisualInspectionAlertLevel(fecha);
          if (level === "none") return null;
          return {
            id: record.id,
            numeroEconomico: record.numeroEconomico,
            sectionSlug: record.section.slug,
            citySlug: record.section.city.slug,
            cityName: record.section.city.name,
            fechaProximaInspeccionVisualInterna: fecha,
            etiquetaTanque: tanque.etiqueta as string | undefined,
            level,
          };
        });
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
  ].sort(
    (a, b) =>
      daysUntil(a.fechaProximaInspeccionVisualInterna) -
      daysUntil(b.fechaProximaInspeccionVisualInterna)
  );

  const hydrostaticAlertVehicles = [
    ...upcomingRecords
      .map((record) => {
        if (multiTanqueIds.has(record.id)) return null;
        if (!isAlertVisibleForSection("hidrostatica", record.section.slug)) return null;
        const fecha = record.technicalSheet?.fechaProximaPruebaHidrostatica;
        if (!fecha) return null;
        const level = getHydrostaticTestAlertLevel(fecha);
        if (level === "none") return null;
        return {
          id: record.id,
          numeroEconomico: record.numeroEconomico,
          sectionSlug: record.section.slug,
          citySlug: record.section.city.slug,
          cityName: record.section.city.name,
          fechaProximaPruebaHidrostatica: fecha,
          etiquetaTanque: undefined as string | undefined,
          level,
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
    ...stationRecords
      .filter((record) => multiTanqueIds.has(record.id))
      .flatMap((record) => {
        if (!isAlertVisibleForSection("hidrostatica", record.section.slug)) return [];
        return record.stationTankTechnicalSheets.map((tanque) => {
          const fecha = tanque.fechaProximaPruebaHidrostatica;
          if (!fecha) return null;
          const level = getHydrostaticTestAlertLevel(fecha);
          if (level === "none") return null;
          return {
            id: record.id,
            numeroEconomico: record.numeroEconomico,
            sectionSlug: record.section.slug,
            citySlug: record.section.city.slug,
            cityName: record.section.city.name,
            fechaProximaPruebaHidrostatica: fecha,
            etiquetaTanque: tanque.etiqueta as string | undefined,
            level,
          };
        });
      })
      .filter((value): value is NonNullable<typeof value> => value !== null),
  ].sort(
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
        sectionSlug: record.section.slug,
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
        sectionSlug: record.section.slug,
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
      const dates = valveDatesFromSheet(record.technicalSheet);
      const level = getValveAlertLevel(dates);
      if (level === "none") return null;
      const vencimiento = getValveVencimiento(dates);
      if (!vencimiento) return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        sectionSlug: record.section.slug,
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
        sectionSlug: record.section.slug,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        vencimiento,
        level,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => daysUntil(a.vencimiento) - daysUntil(b.vencimiento));

  // Válvulas de Estación de carburación / Planta: viven en su propia ficha
  // del tanque (StationTankTechnicalSheet), no en la del vehículo, así que
  // no las capta ninguno de los filtros de arriba — reusa stationRecords
  // (consultado arriba para las 5 alertas de inspección multi-tanque). Una
  // estación con dos tanques (ver VehicleRecord.stationTankTechnicalSheets)
  // puede mandar dos alertas, una por tanque, con la etiqueta para
  // distinguirlas.
  const stationValveAlertVehicles = stationRecords
    .flatMap((record) => {
      if (!isAlertVisibleForSection("valvulas", record.section.slug)) return [];
      const variosTanques = record.stationTankTechnicalSheets.length > 1;
      return record.stationTankTechnicalSheets.map((tanque) => {
        const level = getStationValveAlertLevel(getStationValveVencimiento(tanque));
        if (level === "none") return null;
        const vencimiento = getStationValveVencimiento(tanque);
        if (!vencimiento) return null;
        return {
          id: record.id,
          numeroEconomico: record.numeroEconomico,
          sectionSlug: record.section.slug,
        citySlug: record.section.city.slug,
          cityName: record.section.city.name,
          vencimiento,
          valvulaMasAntigua: oldestStationValve(tanque)?.key,
          etiquetaTanque: variosTanques ? tanque.etiqueta : undefined,
          level,
        };
      });
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => daysUntil(a.vencimiento) - daysUntil(b.vencimiento));

  // Válvulas e instrumentos de un tanque de Planta (ver
  // lib/planta-tank-instruments.ts): a diferencia de las de Estación (una
  // sola alerta combinada arriba), cada instrumento manda su propia alerta
  // por separado — reusa stationRecords, acotado a "planta-ficha-tecnica".
  const plantaInstrumentAlertVehicles = stationRecords
    .filter((record) => record.section.slug === "planta-ficha-tecnica")
    .flatMap((record) => {
      if (!isAlertVisibleForSection("valvulas", record.section.slug)) return [];
      const variosTanques = record.stationTankTechnicalSheets.length > 1;
      return record.stationTankTechnicalSheets.flatMap((tanque) =>
        PLANTA_INSTRUMENT_FIELDS.map((campo) => {
          const vencimiento = getPlantaInstrumentVencimiento(tanque, campo);
          const level = getPlantaInstrumentAlertLevel(vencimiento);
          if (level === "none" || !vencimiento) return null;
          return {
            id: record.id,
            numeroEconomico: record.numeroEconomico,
            sectionSlug: record.section.slug,
        citySlug: record.section.city.slug,
            cityName: record.section.city.name,
            vencimiento,
            campo,
            etiquetaTanque: variosTanques ? tanque.etiqueta : undefined,
            level,
          };
        })
      );
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => daysUntil(a.vencimiento) - daysUntil(b.vencimiento));

  // Póliza de seguro (ver InsurancePolicyLog): la vigente es la de
  // vencimiento más lejano, no la última capturada — si alguien registra una
  // póliza vieja después, la vigente sigue siendo la otra. Consulta aparte
  // porque no vive en la ficha técnica, igual que las válvulas de estación.
  const polizaRecords = await prisma.vehicleRecord.findMany({
    where: { activo: true, section: { cityId: { in: cityIds } }, insurancePolicyLogs: { some: {} } },
    include: {
      insurancePolicyLogs: { orderBy: { fechaVencimiento: "desc" }, take: 1 },
      section: { include: { city: true } },
    },
  });

  const insuranceAlertVehicles = polizaRecords
    .map((record) => {
      if (!isAlertVisibleForSection("poliza", record.section.slug)) return null;
      const vigente = record.insurancePolicyLogs[0];
      if (!vigente) return null;
      const level = getInsuranceAlertLevel(vigente.fechaVencimiento);
      if (level === "none") return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        sectionSlug: record.section.slug,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        vencimiento: vigente.fechaVencimiento,
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
    stationValveAlertVehicles,
    plantaInstrumentAlertVehicles,
    insuranceAlertVehicles,
  };
}
