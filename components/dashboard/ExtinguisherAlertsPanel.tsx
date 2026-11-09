import { MensajeDeAlerta } from "./MensajeDeAlerta";
import { enlaceDeAlerta } from "@/lib/anclas-unidad";
import Link from "next/link";
import { verRecordLabel } from "@/lib/section-labels";
import {
  extinguisherAlertBadgeStyles,
  extinguisherAlertLabel,
  extinguisherAlertMessage,
  type ExtinguisherAlertLevel,
} from "@/lib/extinguisher-alerts";

type AlertVehicle = {
  id: string;
  sectionSlug: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  fechaCalidadMalaExtintor: Date | null;
  level: ExtinguisherAlertLevel;
};

export function ExtinguisherAlertsPanel({ vehicles, titulo }: { vehicles: AlertVehicle[]; titulo?: string }) {
  if (vehicles.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-red-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
        {titulo ?? "Alertas de extintor"}
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
              {<MensajeDeAlerta level={vehicle.level} numeroEconomico={vehicle.numeroEconomico} texto={extinguisherAlertMessage(
                vehicle.level,
                vehicle.fechaCalidadMalaExtintor,
                vehicle.numeroEconomico
              )} />}
              {" "}
              <span className="text-gray-500">({vehicle.cityName})</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${extinguisherAlertBadgeStyles[vehicle.level]}`}
              >
                {extinguisherAlertLabel(vehicle.level, vehicle.fechaCalidadMalaExtintor)}
              </span>
              <Link
                href={`/ciudades/${vehicle.citySlug}/orden-de-pieza?prefillTipo=REFACCION&prefillNombre=Extintor&prefillVehicle=${vehicle.id}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Ordenar pieza →
              </Link>
              <Link
                href={enlaceDeAlerta(vehicle.citySlug, vehicle.id, "extintor", vehicle.sectionSlug)}
                className="text-xs font-medium text-primary hover:underline"
              >
                {verRecordLabel(vehicle.sectionSlug)} →
              </Link>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
