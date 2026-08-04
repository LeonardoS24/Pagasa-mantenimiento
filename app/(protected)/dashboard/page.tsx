import { getSession } from "@/lib/auth";
import { getAccessibleCities } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { CityCard } from "@/components/city/CityCard";
import { UltrasoundAlertsPanel } from "@/components/dashboard/UltrasoundAlertsPanel";
import { VisualInspectionAlertsPanel } from "@/components/dashboard/VisualInspectionAlertsPanel";
import { TightnessTestAlertsPanel } from "@/components/dashboard/TightnessTestAlertsPanel";
import { InternalVisualInspectionAlertsPanel } from "@/components/dashboard/InternalVisualInspectionAlertsPanel";
import { HydrostaticTestAlertsPanel } from "@/components/dashboard/HydrostaticTestAlertsPanel";
import { ExtinguisherAlertsPanel } from "@/components/dashboard/ExtinguisherAlertsPanel";
import { MaintenanceAlertsPanel } from "@/components/dashboard/MaintenanceAlertsPanel";
import { getUltrasoundAlertLevel, daysUntil } from "@/lib/ultrasound-alerts";
import { getVisualInspectionAlertLevel } from "@/lib/visual-inspection-alerts";
import { getTightnessTestAlertLevel } from "@/lib/tightness-test-alerts";
import { getInternalVisualInspectionAlertLevel } from "@/lib/internal-visual-inspection-alerts";
import { getHydrostaticTestAlertLevel } from "@/lib/hydrostatic-test-alerts";
import { getExtinguisherAlertLevel } from "@/lib/extinguisher-alerts";
import { getMaintenanceAlertLevel } from "@/lib/maintenance-alerts";
import { getValveAlertLevel, getValveVencimiento, oldestValve } from "@/lib/valve-alerts";
import { ValveAlertsPanel } from "@/components/dashboard/ValveAlertsPanel";
import { getHoseAlertLevel, getHoseVencimiento } from "@/lib/hose-alerts";
import { HoseAlertsPanel } from "@/components/dashboard/HoseAlertsPanel";

export default async function DashboardPage() {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const cities = await getAccessibleCities(user);

  const soon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const upcomingRecords = await prisma.vehicleRecord.findMany({
    where: {
      activo: true,
      section: { cityId: { in: cities.map((city) => city.id) } },
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
          { fechaFabricacionValvulaServicio: { not: null } },
          { fechaFabricacionValvulaMaximoLlenado: { not: null } },
          { fechaFabricacionValvulaAlivio: { not: null } },
          { fechaFabricacionManguera: { not: null } },
        ],
      },
    },
    include: { technicalSheet: true, section: { include: { city: true } } },
  });

  const alertVehicles = upcomingRecords
    .map((record) => {
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
      const dates = {
        fechaFabricacionValvulaLlenado: record.technicalSheet?.fechaFabricacionValvulaLlenado,
        fechaFabricacionValvulaServicio: record.technicalSheet?.fechaFabricacionValvulaServicio,
        fechaFabricacionValvulaMaximoLlenado:
          record.technicalSheet?.fechaFabricacionValvulaMaximoLlenado,
        fechaFabricacionValvulaAlivio: record.technicalSheet?.fechaFabricacionValvulaAlivio,
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

  return (
    <div>
      <UltrasoundAlertsPanel vehicles={alertVehicles} />
      <VisualInspectionAlertsPanel vehicles={visualAlertVehicles} />
      <TightnessTestAlertsPanel vehicles={tightnessAlertVehicles} />
      <InternalVisualInspectionAlertsPanel vehicles={internalVisualAlertVehicles} />
      <HydrostaticTestAlertsPanel vehicles={hydrostaticAlertVehicles} />
      <ExtinguisherAlertsPanel vehicles={extinguisherAlertVehicles} />
      <MaintenanceAlertsPanel vehicles={maintenanceAlertVehicles} />
      <ValveAlertsPanel vehicles={valveAlertVehicles} />
      <HoseAlertsPanel vehicles={hoseAlertVehicles} />

      <form action="/buscar" method="GET" className="mb-8">
        <input
          type="search"
          name="q"
          placeholder="Buscar número económico, placas, sucursal..."
          className="w-full rounded-lg border border-gray-300 bg-white px-5 py-4 text-lg text-ink shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </form>

      <h1 className="mb-1 text-2xl font-semibold text-primary">Ciudades</h1>
      <p className="mb-6 text-sm text-ink">
        {cities.length > 0
          ? "Selecciona una ciudad para ver sus apartados."
          : "Aún no tienes ciudades asignadas. Contacta a un administrador."}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cities.map((city) => (
          <CityCard key={city.id} city={city} />
        ))}
      </div>
    </div>
  );
}
