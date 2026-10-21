import { FundamentoNormativo } from "@/components/normas/FundamentoNormativo";
import Link from "next/link";
import { ListaPorCiudad } from "./ListaPorCiudad";
import { verRecordLabel } from "@/lib/section-labels";
import {
  aniosVigenciaValvulas,
  grupoValvulasDeApartado,
  type GrupoValvulas,
  valveAlertBadgeStyles,
  valveAlertRowStyles,
  valveAlertLabel,
  valveAlertMessage,
  type ValveAlertLevel,
  type ValveDates,
} from "@/lib/valve-alerts";

type AlertVehicle = {
  id: string;
  sectionSlug: string;
  numeroEconomico: string;
  citySlug: string;
  cityName: string;
  vencimiento: Date;
  valvulaMasAntigua?: keyof ValveDates;
  level: ValveAlertLevel;
};

// Un cuadro por tipo de tanque (ver grupoValvulasDeApartado): las válvulas del
// tanque de carga y las de carburación son sistemas distintos, con plazo
// distinto, y no deben leerse como una sola lista. El plazo del título sale
// de la misma función que calcula el vencimiento.
const GRUPOS: { id: GrupoValvulas; titulo: string; slugPlazo: string; fundamento: string[] }[] = [
  { id: "tanque-de-carga", titulo: "Auto-Tanques y Semirremolques", slugPlazo: "auto-tanques", fundamento: ["valvulas-tanque-carga"] },
  {
    id: "carburacion",
    titulo: "Vehículo con tanque de carburación",
    slugPlazo: "vehiculo-con-tanque-de-carburacion",
    fundamento: ["valvulas-carburacion"],
  },
  { id: "otras", titulo: "Otras unidades", slugPlazo: "", fundamento: [] },
];

export function ValveAlertsPanel({ vehicles, ciudades }: { vehicles: AlertVehicle[]; ciudades?: string[] }) {
  if (vehicles.length === 0) return null;

  return (
    <>
      {GRUPOS.map((grupo) => {
        const delGrupo = vehicles.filter((v) => grupoValvulasDeApartado(v.sectionSlug) === grupo.id);
        if (delGrupo.length === 0) return null;
        return (
          <div key={grupo.id} className="mb-8 rounded-lg border border-red-200 bg-white p-5">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
              Alertas de cambio de válvulas — {grupo.titulo}
              <span className="ml-2 text-xs font-normal normal-case text-gray-500">
                (vencen a los {aniosVigenciaValvulas(grupo.slugPlazo)} años de fabricación)
              </span>
            </h2>
            <ListaPorCiudad items={delGrupo} ciudades={ciudades}>
              {(vehicle) => (
                <li
                  key={vehicle.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${valveAlertRowStyles[vehicle.level]}`}
                >
                  <span className="text-ink">
                    {valveAlertMessage(
                      vehicle.level,
                      vehicle.vencimiento,
                      vehicle.numeroEconomico,
                      vehicle.valvulaMasAntigua
                    )}{" "}
                    <span className="text-gray-500">({vehicle.cityName})</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${valveAlertBadgeStyles[vehicle.level]}`}
                    >
                      {valveAlertLabel(vehicle.level, vehicle.vencimiento)}
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
            <FundamentoNormativo claves={grupo.fundamento} className="mt-4" />
          </div>
        );
      })}
    </>
  );
}
