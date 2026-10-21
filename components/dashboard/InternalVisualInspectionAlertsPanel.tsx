import Link from "next/link";
import { ListaPorCiudad } from "./ListaPorCiudad";
import { verRecordLabel } from "@/lib/section-labels";
import {
  internalVisualInspectionAlertBadgeStyles,
  internalVisualInspectionAlertLabel,
  internalVisualInspectionAlertMessage,
  type InternalVisualInspectionAlertLevel,
} from "@/lib/internal-visual-inspection-alerts";

type AlertVehicle = {
  id: string;
  sectionSlug: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  fechaProximaInspeccionVisualInterna: Date;
  etiquetaTanque?: string;
  level: InternalVisualInspectionAlertLevel;
};

export function InternalVisualInspectionAlertsPanel({ vehicles, ciudades }: { vehicles: AlertVehicle[]; ciudades?: string[] }) {
  if (vehicles.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-red-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
        Alertas de inspección visual interna de tanque
      </h2>
      <ListaPorCiudad items={vehicles} ciudades={ciudades}>
        {(vehicle, i) => (
          <li
            key={`${vehicle.id}-${i}`}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${
              vehicle.level === "red" ? "bg-red-50" : "bg-yellow-50"
            }`}
          >
            <span className="text-ink">
              {internalVisualInspectionAlertMessage(
                vehicle.level,
                vehicle.fechaProximaInspeccionVisualInterna,
                vehicle.numeroEconomico,
                vehicle.etiquetaTanque
              )}
              {" "}
              <span className="text-gray-500">({vehicle.cityName})</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${internalVisualInspectionAlertBadgeStyles[vehicle.level]}`}
              >
                {internalVisualInspectionAlertLabel(
                  vehicle.level,
                  vehicle.fechaProximaInspeccionVisualInterna
                )}
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
