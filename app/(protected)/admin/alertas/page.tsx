import { getAllRealCityIds } from "@/lib/aggregate-city";
import { getAllVehicleAlerts } from "@/lib/vehicle-alerts-summary";
import { PanelesDeAlertas, totalDeAlertas } from "@/components/dashboard/PanelesDeAlertas";

// Mismas 9 alertas que Inicio (ver lib/vehicle-alerts-summary.ts), pero de
// TODAS las ciudades reales sin importar a cuáles tenga acceso asignado el
// admin que esté viendo esta página: así no hace falta ir a Inicio para
// ver el panorama completo de vencimientos.
export default async function AdminAlertasPage() {
  const cityIds = await getAllRealCityIds();

  const alertas = await getAllVehicleAlerts(cityIds);

  const totalAlertas = totalDeAlertas(alertas);

  return (
    <div>
      <p className="mb-6 text-sm text-ink">
        {totalAlertas > 0
          ? `${totalAlertas} alerta(s) activa(s) en todas las ciudades.`
          : "No hay alertas activas en ninguna ciudad."}
      </p>
      <PanelesDeAlertas alertas={alertas} />
    </div>
  );
}
