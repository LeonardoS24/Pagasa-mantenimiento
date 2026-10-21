import Link from "next/link";
import { ListaPorCiudad } from "./ListaPorCiudad";
import { verRecordLabel } from "@/lib/section-labels";
import { dictamenAlertLabel, dictamenAlertMessage } from "@/lib/dictamen-alerts";
import type { ValveAlertLevel } from "@/lib/valve-alerts";

type AlertVehicle = {
  id: string;
  sectionSlug: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  dictamen: string;
  vencimiento: Date;
  level: ValveAlertLevel;
};

const badge: Record<ValveAlertLevel, string> = {
  none: "",
  yellow: "bg-yellow-100 text-yellow-800 border border-yellow-300",
  red: "bg-red-100 text-red-800 border border-red-300",
};

// Dictámenes de vigencia anual (operación y mantenimiento, NOM-068, instalación
// de carburación, estación): ver lib/dictamen-alerts.ts.
export function DictamenAlertsPanel({ vehicles, ciudades }: { vehicles: AlertVehicle[]; ciudades?: string[] }) {
  if (vehicles.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-red-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
        Alertas de vencimiento de dictámenes
      </h2>
      <ListaPorCiudad items={vehicles} ciudades={ciudades}>
        {(vehicle) => (
          <li
            key={`${vehicle.id}-${vehicle.dictamen}`}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${
              vehicle.level === "red" ? "bg-red-50" : "bg-yellow-50"
            }`}
          >
            <span className="text-ink">
              {dictamenAlertMessage(vehicle.level, vehicle.vencimiento, vehicle.numeroEconomico, vehicle.dictamen)}{" "}
              <span className="text-gray-500">({vehicle.cityName})</span>
            </span>
            <span className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge[vehicle.level]}`}>
                {dictamenAlertLabel(vehicle.level, vehicle.vencimiento)}
              </span>
              <Link
                href={`/ciudades/${vehicle.citySlug}/vehiculo/${vehicle.id}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                {verRecordLabel(vehicle.sectionSlug)} →
              </Link>
            </span>
          </li>
        )}
      </ListaPorCiudad>
    </div>
  );
}
