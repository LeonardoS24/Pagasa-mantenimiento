import Link from "next/link";
import type { MaintenanceLog, VehicleRecord } from "@prisma/client";
import { maintenanceStatusLabels, maintenanceStatusStyles, type MaintenanceStatus } from "@/lib/vehicle-enums";
import { formatDate } from "@/lib/dates";

type LogWithVehicle = MaintenanceLog & { vehicleRecord: VehicleRecord };

export function CityMaintenanceFeed({
  logs,
  citySlug,
}: {
  logs: LogWithVehicle[];
  citySlug: string;
}) {
  if (logs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-ink">
        <p className="text-lg font-medium text-primary">Sin mantenimientos registrados</p>
        <p className="mt-1 text-sm">
          Los mantenimientos que registres en cada unidad aparecerán aquí, ordenados por fecha.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => {
        const status = log.estatus as MaintenanceStatus;
        return (
          <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="text-sm text-ink">
              <span className="font-medium text-primary">{formatDate(log.fecha)}</span>
              {" · "}
              <Link
                href={`/ciudades/${citySlug}/vehiculo/${log.vehicleRecordId}`}
                className="font-medium text-primary hover:underline"
              >
                {log.vehicleRecord.numeroEconomico}
              </Link>
              {" — "}
              {log.tipoMantenimiento} — {log.tipoServicio}
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${maintenanceStatusStyles[status]}`}
            >
              {maintenanceStatusLabels[status] ?? log.estatus}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
