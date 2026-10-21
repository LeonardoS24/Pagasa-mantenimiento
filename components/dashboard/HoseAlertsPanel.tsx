import { FundamentoNormativo } from "@/components/normas/FundamentoNormativo";
import Link from "next/link";
import { ListaPorCiudad } from "./ListaPorCiudad";
import { verRecordLabel } from "@/lib/section-labels";
import {
  hoseAlertBadgeStyles,
  hoseAlertLabel,
  hoseAlertMessage,
  type HoseAlertLevel,
} from "@/lib/hose-alerts";

type AlertVehicle = {
  id: string;
  sectionSlug: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  vencimiento: Date;
  level: HoseAlertLevel;
  // "Manguera" o "Conector flexible": una unidad puede tener las dos alertas.
  elemento?: string;
};

export function HoseAlertsPanel({ vehicles, ciudades }: { vehicles: AlertVehicle[]; ciudades?: string[] }) {
  if (vehicles.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-red-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
        Alertas de cambio de mangueras y conectores flexibles
      </h2>
      <ListaPorCiudad items={vehicles} ciudades={ciudades}>
        {(vehicle) => (
          <li
            key={`${vehicle.id}-${vehicle.elemento ?? ""}`}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${
              vehicle.level === "red" ? "bg-red-50" : "bg-yellow-50"
            }`}
          >
            <span className="text-ink">
              {hoseAlertMessage(vehicle.level, vehicle.vencimiento, vehicle.numeroEconomico, vehicle.elemento)}
              {" "}
              <span className="text-gray-500">({vehicle.cityName})</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${hoseAlertBadgeStyles[vehicle.level]}`}
              >
                {hoseAlertLabel(vehicle.level, vehicle.vencimiento, vehicle.elemento)}
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
      <FundamentoNormativo
        claves={[
          ...(vehicles.some((v) => v.sectionSlug === "auto-tanques" && v.elemento !== "Conector flexible")
            ? ["manguera-trasiego"]
            : []),
          ...(vehicles.some((v) => v.elemento === "Conector flexible") ? ["conectores-flexibles"] : []),
          ...(vehicles.some((v) => v.sectionSlug === "vehiculo-con-tanque-de-carburacion")
            ? ["manguera-carburacion"]
            : []),
        ]}
        className="mt-4"
      />
    </div>
  );
}
