import Link from "next/link";
import { ListaPorCiudad } from "./ListaPorCiudad";
import { verRecordLabel } from "@/lib/section-labels";
import {
  tightnessTestAlertBadgeStyles,
  tightnessTestAlertLabel,
  tightnessTestAlertMessage,
  type TightnessTestAlertLevel,
} from "@/lib/tightness-test-alerts";

type AlertVehicle = {
  id: string;
  sectionSlug: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  fechaProximaPruebaHermeticidad: Date;
  etiquetaTanque?: string;
  level: TightnessTestAlertLevel;
};

export function TightnessTestAlertsPanel({ vehicles, ciudades }: { vehicles: AlertVehicle[]; ciudades?: string[] }) {
  if (vehicles.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-red-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
        Alertas de prueba de hermeticidad de tanque
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
              {tightnessTestAlertMessage(
                vehicle.level,
                vehicle.fechaProximaPruebaHermeticidad,
                vehicle.numeroEconomico,
                vehicle.etiquetaTanque
              )}
              {" "}
              <span className="text-gray-500">({vehicle.cityName})</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${tightnessTestAlertBadgeStyles[vehicle.level]}`}
              >
                {tightnessTestAlertLabel(vehicle.level, vehicle.fechaProximaPruebaHermeticidad)}
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
