import { FundamentoNormativo } from "@/components/normas/FundamentoNormativo";
import Link from "next/link";
import { valveAlertBadgeStyles, valveAlertRowStyles, valveAlertLabel, type ValveAlertLevel } from "@/lib/valve-alerts";
import { getPlantaInstrumentAlertMessage, type PlantaInstrumentField } from "@/lib/planta-tank-instruments";

type PlantaInstrumentAlertVehicle = {
  id: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  vencimiento: Date;
  campo: PlantaInstrumentField;
  etiquetaTanque?: string;
  level: ValveAlertLevel;
};

// Igual que StationValveAlertsPanel, pero un renglón por instrumento (ver
// lib/planta-tank-instruments.ts) en vez de un solo vencimiento combinado
// por tanque.
export function PlantaInstrumentAlertsPanel({ vehicles }: { vehicles: PlantaInstrumentAlertVehicle[] }) {
  if (vehicles.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-red-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
        Alertas de válvulas e instrumentos — Planta
      </h2>
      <ul className="space-y-2">
        {vehicles.map((vehicle, i) => (
          <li
            key={`${vehicle.id}-${vehicle.campo}-${i}`}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${valveAlertRowStyles[vehicle.level]}`}
          >
            <span className="text-ink">
              {getPlantaInstrumentAlertMessage(
                vehicle.level,
                vehicle.vencimiento,
                vehicle.numeroEconomico,
                vehicle.campo,
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
                Ver planta →
              </Link>
            </span>
          </li>
        ))}
      </ul>
      <FundamentoNormativo claves={["instrumentos-planta"]} className="mt-4" />
    </div>
  );
}
