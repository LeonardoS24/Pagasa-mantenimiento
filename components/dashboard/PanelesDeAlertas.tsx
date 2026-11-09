import type { AlertasDelSistema } from "@/lib/vehicle-alerts-summary";
import { UltrasoundAlertsPanel } from "./UltrasoundAlertsPanel";
import { VisualInspectionAlertsPanel } from "./VisualInspectionAlertsPanel";
import { TightnessTestAlertsPanel } from "./TightnessTestAlertsPanel";
import { InternalVisualInspectionAlertsPanel } from "./InternalVisualInspectionAlertsPanel";
import { HydrostaticTestAlertsPanel } from "./HydrostaticTestAlertsPanel";
import { ExtinguisherAlertsPanel } from "./ExtinguisherAlertsPanel";
import { MaintenanceAlertsPanel } from "./MaintenanceAlertsPanel";
import { ValveAlertsPanel } from "./ValveAlertsPanel";
import { StationValveAlertsPanel } from "./StationValveAlertsPanel";
import { PlantaInstrumentAlertsPanel } from "./PlantaInstrumentAlertsPanel";
import { HoseAlertsPanel } from "./HoseAlertsPanel";
import { DictamenAlertsPanel } from "./DictamenAlertsPanel";
import { InsuranceAlertsPanel } from "./InsuranceAlertsPanel";
import { AlertasPropiasPanel } from "./AlertasPropiasPanel";

// Todos los cuadros de alertas, en el mismo orden, para Inicio, la portada de
// cada ciudad y Administración → Alertas (una sola lista: así una alerta
// nueva o renombrada sale igual en las tres).
export function PanelesDeAlertas({ alertas }: { alertas: AlertasDelSistema }) {
  const t = alertas.titulos;
  return (
    <>
      <UltrasoundAlertsPanel vehicles={alertas.alertVehicles} titulo={t.ultrasonido} />
      <VisualInspectionAlertsPanel vehicles={alertas.visualAlertVehicles} titulo={t.visualExterna} />
      <TightnessTestAlertsPanel vehicles={alertas.tightnessAlertVehicles} titulo={t.hermeticidad} />
      <InternalVisualInspectionAlertsPanel vehicles={alertas.internalVisualAlertVehicles} titulo={t.visualInterna} />
      <HydrostaticTestAlertsPanel vehicles={alertas.hydrostaticAlertVehicles} titulo={t.hidrostatica} />
      <ExtinguisherAlertsPanel vehicles={alertas.extinguisherAlertVehicles} titulo={t.extintor} />
      <MaintenanceAlertsPanel vehicles={alertas.maintenanceAlertVehicles} titulo={t.mantenimiento} />
      <ValveAlertsPanel vehicles={alertas.valveAlertVehicles} titulo={t.valvulas} />
      <StationValveAlertsPanel vehicles={alertas.stationValveAlertVehicles} titulo={t.valvulasEstacion} />
      <PlantaInstrumentAlertsPanel vehicles={alertas.plantaInstrumentAlertVehicles} titulo={t.instrumentosPlanta} />
      <HoseAlertsPanel vehicles={alertas.hoseAlertVehicles} titulo={t.mangueras} />
      <DictamenAlertsPanel vehicles={alertas.dictamenAlertVehicles} titulo={t.dictamen} />
      <InsuranceAlertsPanel vehicles={alertas.insuranceAlertVehicles} titulo={t.poliza} />
      <AlertasPropiasPanel alertas={alertas.alertasPropias} />
    </>
  );
}

// Cuántas alertas hay en total (para los contadores de las páginas).
export function totalDeAlertas(alertas: AlertasDelSistema): number {
  let total = 0;
  for (const [clave, valor] of Object.entries(alertas)) {
    if (clave !== "titulos" && Array.isArray(valor)) total += valor.length;
  }
  return total;
}
