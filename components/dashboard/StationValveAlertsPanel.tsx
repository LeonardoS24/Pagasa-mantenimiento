import Link from "next/link";
import { valveAlertBadgeStyles, valveAlertRowStyles, valveAlertLabel, type ValveAlertLevel } from "@/lib/valve-alerts";
import { getStationValveAlertMessage, type StationValveField } from "@/lib/station-valves";

type StationValveAlertVehicle = {
  id: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  vencimiento: Date;
  valvulaMasAntigua?: StationValveField;
  etiquetaTanque?: string;
  level: ValveAlertLevel;
};

// Igual que ValveAlertsPanel, pero para el juego de válvulas propio de una
// Estación de carburación / Planta (ver lib/station-valves.ts) — vive en su
// propia ficha del tanque, no en la del vehículo, así que necesita su propio
// cálculo y su propio texto (getStationValveAlertMessage).
export function StationValveAlertsPanel({ vehicles }: { vehicles: StationValveAlertVehicle[] }) {
  if (vehicles.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-red-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
        Alertas de cambio de válvulas — Estaciones
      </h2>
      <ul className="space-y-2">
        {vehicles.map((vehicle, i) => (
          <li
            key={`${vehicle.id}-${i}`}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${valveAlertRowStyles[vehicle.level]}`}
          >
            <span className="text-ink">
              {getStationValveAlertMessage(
                vehicle.level,
                vehicle.vencimiento,
                vehicle.numeroEconomico,
                vehicle.valvulaMasAntigua,
                vehicle.etiquetaTanque
              )}
              {" "}
              <span className="text-gray-500">({vehicle.cityName})</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${valveAlertBadgeStyles[vehicle.level]}`}
              >
                {valveAlertLabel(vehicle.level, vehicle.vencimiento)}
              </span>
              <Link
                href={`/ciudades/${vehicle.citySlug}/vehiculo/${vehicle.id}#valvulas`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver estación →
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
