import Link from "next/link";
import {
  maintenanceAlertBadgeStyles,
  maintenanceAlertLabel,
  maintenanceAlertMessage,
  type MaintenanceAlertLevel,
} from "@/lib/maintenance-alerts";

type AlertVehicle = {
  id: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  fechaProximoMantenimiento: Date;
  kilometrajeProximoMantenimiento: number | null;
  level: MaintenanceAlertLevel;
};

export function MaintenanceAlertsPanel({ vehicles }: { vehicles: AlertVehicle[] }) {
  if (vehicles.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-red-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
        Alertas de mantenimiento preventivo
      </h2>
      <ul className="space-y-2">
        {vehicles.map((vehicle) => (
          <li
            key={vehicle.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${
              vehicle.level === "red" ? "bg-red-50" : "bg-yellow-50"
            }`}
          >
            <span className="text-ink">
              {maintenanceAlertMessage(
                vehicle.level,
                vehicle.fechaProximoMantenimiento,
                vehicle.numeroEconomico,
                vehicle.kilometrajeProximoMantenimiento
              )}
              {" "}
              <span className="text-gray-500">({vehicle.cityName})</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${maintenanceAlertBadgeStyles[vehicle.level]}`}
              >
                {maintenanceAlertLabel(
                  vehicle.level,
                  vehicle.fechaProximoMantenimiento,
                  vehicle.kilometrajeProximoMantenimiento
                )}
              </span>
              <Link
                href={`/ciudades/${vehicle.citySlug}/vehiculo/${vehicle.id}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver unidad →
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
