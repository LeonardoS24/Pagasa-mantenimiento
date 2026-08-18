import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { resolveSectionPath } from "@/lib/section-path";
import { isAggregateCitySlug, getAllRealCityIds } from "@/lib/aggregate-city";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SectionCard } from "@/components/city/SectionCard";
import { getAllVehicleAlerts } from "@/lib/vehicle-alerts-summary";
import { UltrasoundAlertsPanel } from "@/components/dashboard/UltrasoundAlertsPanel";
import { VisualInspectionAlertsPanel } from "@/components/dashboard/VisualInspectionAlertsPanel";
import { TightnessTestAlertsPanel } from "@/components/dashboard/TightnessTestAlertsPanel";
import { InternalVisualInspectionAlertsPanel } from "@/components/dashboard/InternalVisualInspectionAlertsPanel";
import { HydrostaticTestAlertsPanel } from "@/components/dashboard/HydrostaticTestAlertsPanel";
import { ExtinguisherAlertsPanel } from "@/components/dashboard/ExtinguisherAlertsPanel";
import { MaintenanceAlertsPanel } from "@/components/dashboard/MaintenanceAlertsPanel";
import { ValveAlertsPanel } from "@/components/dashboard/ValveAlertsPanel";
import { HoseAlertsPanel } from "@/components/dashboard/HoseAlertsPanel";
import { StationValveAlertsPanel } from "@/components/dashboard/StationValveAlertsPanel";
import { PlantaInstrumentAlertsPanel } from "@/components/dashboard/PlantaInstrumentAlertsPanel";
import { InsuranceAlertsPanel } from "@/components/dashboard/InsuranceAlertsPanel";
import { ComplianceOverviewPanel } from "@/components/city/ComplianceOverviewPanel";
import { getComplianceOverview } from "@/lib/compliance-stats";

export default async function CityPage({
  params,
}: {
  params: { citySlug: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };

  await assertCityAccess(user, params.citySlug);
  const { city, children } = await resolveSectionPath(params.citySlug, []);

  // "Administración" no tiene unidades propias: igual que su Bitácora de
  // unidades (ver lib/aggregate-city.ts), sus alertas combinan las de todas
  // las ciudades reales en vez de salir vacías.
  const alertCityIds = isAggregateCitySlug(city.slug) ? await getAllRealCityIds() : [city.id];
  const {
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
  } = await getAllVehicleAlerts(alertCityIds);
  // Solo Administración (ciudad agregada) muestra el resumen de
  // cumplimiento de normatividad; cada ciudad real ya lo trae por unidad.
  const complianceOverview = isAggregateCitySlug(city.slug) ? await getComplianceOverview(alertCityIds) : [];

  return (
    <div>
      <Breadcrumb items={[{ label: "Inicio", href: "/dashboard" }, { label: city.name }]} />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="9" height="18" />
              <rect x="14" y="8" width="6" height="13" />
              <path d="M7 7h3M7 11h3M7 15h3M16.5 11.5h1M16.5 15h1" />
            </svg>
          </span>
          <h1 className="text-2xl font-semibold text-primary">{city.name}</h1>
        </div>
        <form
          action={`/api/ciudades/${city.slug}/excel`}
          method="get"
          className="flex items-center gap-2"
        >
          <select
            name="ambito"
            defaultValue="todo"
            className="rounded-md border border-gray-300 bg-white px-2 py-2 text-sm text-ink focus:border-primary focus:outline-none"
          >
            <option value="todo">Todo</option>
            <option value="unidades">Unidades</option>
            <option value="estaciones">Estaciones</option>
            <option value="planta">Planta</option>
          </select>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0-4-4m4 4 4-4" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Descargar Excel
          </button>
        </form>
      </div>

      <UltrasoundAlertsPanel vehicles={alertVehicles} />
      <VisualInspectionAlertsPanel vehicles={visualAlertVehicles} />
      <TightnessTestAlertsPanel vehicles={tightnessAlertVehicles} />
      <InternalVisualInspectionAlertsPanel vehicles={internalVisualAlertVehicles} />
      <HydrostaticTestAlertsPanel vehicles={hydrostaticAlertVehicles} />
      <ExtinguisherAlertsPanel vehicles={extinguisherAlertVehicles} />
      <MaintenanceAlertsPanel vehicles={maintenanceAlertVehicles} />
      <ValveAlertsPanel vehicles={valveAlertVehicles} />
      <StationValveAlertsPanel vehicles={stationValveAlertVehicles} />
      <PlantaInstrumentAlertsPanel vehicles={plantaInstrumentAlertVehicles} />
      <HoseAlertsPanel vehicles={hoseAlertVehicles} />
      <InsuranceAlertsPanel vehicles={insuranceAlertVehicles} />
      <ComplianceOverviewPanel rows={complianceOverview} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children.map((section) => (
          <SectionCard
            key={section.id}
            name={section.name}
            slug={section.slug}
            href={`/ciudades/${city.slug}/${section.slug}`}
          />
        ))}
      </div>
    </div>
  );
}
