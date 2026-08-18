import Link from "next/link";
import { verRecordLabel } from "@/lib/section-labels";
import {
  insuranceAlertBadgeStyles,
  insuranceAlertRowStyles,
  insuranceAlertLabel,
  insuranceAlertMessage,
  type InsuranceAlertLevel,
} from "@/lib/insurance-alerts";

type InsuranceAlertVehicle = {
  id: string;
  sectionSlug: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  vencimiento: Date;
  level: InsuranceAlertLevel;
};

// Mismo formato que los demás paneles de alertas de vencimiento: la póliza de
// seguro de la unidad (ver InsurancePolicyLog y el apartado "Documentación").
export function InsuranceAlertsPanel({ vehicles }: { vehicles: InsuranceAlertVehicle[] }) {
  if (vehicles.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-red-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
        Alertas de vencimiento de póliza de seguro
      </h2>
      <ul className="space-y-2">
        {vehicles.map((vehicle) => (
          <li
            key={vehicle.id}
            className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${insuranceAlertRowStyles[vehicle.level]}`}
          >
            <span className="text-ink">
              {insuranceAlertMessage(vehicle.level, vehicle.vencimiento, vehicle.numeroEconomico)}{" "}
              <span className="text-gray-500">({vehicle.cityName})</span>
            </span>
            <span className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${insuranceAlertBadgeStyles[vehicle.level]}`}
              >
                {insuranceAlertLabel(vehicle.level, vehicle.vencimiento)}
              </span>
              <Link
                href={`/ciudades/${vehicle.citySlug}/vehiculo/${vehicle.id}#documentacion`}
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
