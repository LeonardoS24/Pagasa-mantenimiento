import { getAllRealCityIds } from "@/lib/aggregate-city";
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

// Mismas 9 alertas que Inicio (ver lib/vehicle-alerts-summary.ts), pero de
// TODAS las ciudades reales sin importar a cuáles tenga acceso asignado el
// admin que esté viendo esta página: así no hace falta ir a Inicio para
// ver el panorama completo de vencimientos.
export default async function AdminAlertasPage() {
  const cityIds = await getAllRealCityIds();

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
    stationValveAlertVehicles.length +
    plantaInstrumentAlertVehicles.length;

  return (
    <div>
      <p className="mb-6 text-sm text-ink">
        {totalAlertas > 0
          ? `${totalAlertas} alerta(s) activa(s) en todas las ciudades.`
          : "No hay alertas activas en ninguna ciudad."}
      </p>
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
    </div>
  );
}
