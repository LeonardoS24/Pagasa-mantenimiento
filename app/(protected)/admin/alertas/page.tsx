import { getAllRealCityIds } from "@/lib/aggregate-city";
import { prisma } from "@/lib/prisma";
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
import { DictamenAlertsPanel } from "@/components/dashboard/DictamenAlertsPanel";
import { StationValveAlertsPanel } from "@/components/dashboard/StationValveAlertsPanel";
import { PlantaInstrumentAlertsPanel } from "@/components/dashboard/PlantaInstrumentAlertsPanel";
import { InsuranceAlertsPanel } from "@/components/dashboard/InsuranceAlertsPanel";

// Mismas alertas que Inicio (ver lib/vehicle-alerts-summary.ts), pero de
// TODAS las ciudades reales sin importar a cuáles tenga acceso asignado el
// admin que esté viendo esta página: así no hace falta ir a Inicio para
// ver el panorama completo de vencimientos.
export default async function AdminAlertasPage() {
  const cityIds = await getAllRealCityIds();
  // Las alertas de cada tipo se separan por ciudad, en el mismo orden que las
  // ciudades del menú lateral (se cambia en Ciudades y apartados).
  const ciudades = (
    await prisma.city.findMany({ where: { id: { in: cityIds } }, orderBy: [{ order: "asc" }, { name: "asc" }], select: { name: true } })
  ).map((c) => c.name);

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
    dictamenAlertVehicles,
    stationValveAlertVehicles,
    plantaInstrumentAlertVehicles,
    insuranceAlertVehicles,
  } = await getAllVehicleAlerts(cityIds);

  const totalAlertas =
    alertVehicles.length +
    visualAlertVehicles.length +
    tightnessAlertVehicles.length +
    internalVisualAlertVehicles.length +
    hydrostaticAlertVehicles.length +
    extinguisherAlertVehicles.length +
    maintenanceAlertVehicles.length +
    valveAlertVehicles.length +
    hoseAlertVehicles.length +
    dictamenAlertVehicles.length +
    stationValveAlertVehicles.length +
    plantaInstrumentAlertVehicles.length +
    insuranceAlertVehicles.length;

  return (
    <div>
      <p className="mb-6 text-sm text-ink">
        {totalAlertas > 0
          ? `${totalAlertas} alerta(s) activa(s) en todas las ciudades.`
          : "No hay alertas activas en ninguna ciudad."}
      </p>
      <UltrasoundAlertsPanel vehicles={alertVehicles} ciudades={ciudades} />
      <VisualInspectionAlertsPanel vehicles={visualAlertVehicles} ciudades={ciudades} />
      <TightnessTestAlertsPanel vehicles={tightnessAlertVehicles} ciudades={ciudades} />
      <InternalVisualInspectionAlertsPanel vehicles={internalVisualAlertVehicles} ciudades={ciudades} />
      <HydrostaticTestAlertsPanel vehicles={hydrostaticAlertVehicles} ciudades={ciudades} />
      <ExtinguisherAlertsPanel vehicles={extinguisherAlertVehicles} ciudades={ciudades} />
      <MaintenanceAlertsPanel vehicles={maintenanceAlertVehicles} ciudades={ciudades} />
      <ValveAlertsPanel vehicles={valveAlertVehicles} ciudades={ciudades} />
      <StationValveAlertsPanel vehicles={stationValveAlertVehicles} ciudades={ciudades} />
      <PlantaInstrumentAlertsPanel vehicles={plantaInstrumentAlertVehicles} ciudades={ciudades} />
      <HoseAlertsPanel vehicles={hoseAlertVehicles} ciudades={ciudades} />
      <DictamenAlertsPanel vehicles={dictamenAlertVehicles} ciudades={ciudades} />
      <InsuranceAlertsPanel vehicles={insuranceAlertVehicles} ciudades={ciudades} />
    </div>
  );
}
