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
import { getUltrasoundAlertLevel, daysUntil } from "@/lib/ultrasound-alerts";
import { getVisualInspectionAlertLevel } from "@/lib/visual-inspection-alerts";
import { getTightnessTestAlertLevel } from "@/lib/tightness-test-alerts";
import { getInternalVisualInspectionAlertLevel } from "@/lib/internal-visual-inspection-alerts";
import { getHydrostaticTestAlertLevel } from "@/lib/hydrostatic-test-alerts";
import { getExtinguisherAlertLevel } from "@/lib/extinguisher-alerts";

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

  return (
    <div>
      <UltrasoundAlertsPanel vehicles={alertVehicles} />
      <VisualInspectionAlertsPanel vehicles={visualAlertVehicles} />
      <TightnessTestAlertsPanel vehicles={tightnessAlertVehicles} />
      <InternalVisualInspectionAlertsPanel vehicles={internalVisualAlertVehicles} />
      <HydrostaticTestAlertsPanel vehicles={hydrostaticAlertVehicles} />
      <ExtinguisherAlertsPanel vehicles={extinguisherAlertVehicles} />
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
