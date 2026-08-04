import { Fragment } from "react";
import Link from "next/link";
import type { VehicleRecord, VehicleTechnicalSheet } from "@prisma/client";
import {
  getUltrasoundAlertLevel,
  ultrasoundAlertBadgeStyles,
  ultrasoundAlertLabel,
  ultrasoundAlertRowStyles,
} from "@/lib/ultrasound-alerts";
import {
  getVisualInspectionAlertLevel,
  visualInspectionAlertBadgeStyles,
  visualInspectionAlertLabel,
} from "@/lib/visual-inspection-alerts";
import {
  getTightnessTestAlertLevel,
  tightnessTestAlertBadgeStyles,
  tightnessTestAlertLabel,
} from "@/lib/tightness-test-alerts";
import {
  getInternalVisualInspectionAlertLevel,
  internalVisualInspectionAlertBadgeStyles,
  internalVisualInspectionAlertLabel,
} from "@/lib/internal-visual-inspection-alerts";
import {
  getHydrostaticTestAlertLevel,
  hydrostaticTestAlertBadgeStyles,
  hydrostaticTestAlertLabel,
} from "@/lib/hydrostatic-test-alerts";
import {
  getExtinguisherAlertLevel,
  extinguisherAlertBadgeStyles,
  extinguisherAlertLabel,
} from "@/lib/extinguisher-alerts";
import {
  getMaintenanceAlertLevel,
  maintenanceAlertBadgeStyles,
  maintenanceAlertLabel,
} from "@/lib/maintenance-alerts";
import { getValveAlertLevel, getValveVencimiento, valveAlertBadgeStyles, valveAlertLabel } from "@/lib/valve-alerts";
import { getHoseAlertLevel, getHoseVencimiento, hoseAlertBadgeStyles, hoseAlertLabel } from "@/lib/hose-alerts";

function worstRowStyle(...levels: ("none" | "yellow" | "red")[]): string {
  if (levels.includes("red")) return ultrasoundAlertRowStyles.red;
  if (levels.includes("yellow")) return ultrasoundAlertRowStyles.yellow;
  return "";
}

type VehicleRecordWithSheet = VehicleRecord & { technicalSheet: VehicleTechnicalSheet | null };

function formatAnterior(record: VehicleRecord): string | null {
  const parts = [record.numeroAnterior, record.localidadAnterior].filter(
    (value): value is string => Boolean(value)
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

export function VehicleTable({
  records,
  citySlug,
}: {
  records: VehicleRecordWithSheet[];
  citySlug: string;
}) {
  if (records.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay números económicos registrados en este apartado.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-2">Número económico</th>
            <th className="whitespace-nowrap px-4 py-2">Sucursal</th>
            <th className="whitespace-nowrap px-4 py-2">Año</th>
            <th className="whitespace-nowrap px-4 py-2">Placas</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => {
            const isFirstInactive = !record.activo && (index === 0 || records[index - 1].activo);
            const anterior = formatAnterior(record);
            const alertLevel = record.activo
              ? getUltrasoundAlertLevel(record.technicalSheet?.fechaProximoUltrasonido)
              : "none";
            const visualAlertLevel = record.activo
              ? getVisualInspectionAlertLevel(record.technicalSheet?.fechaProximaInspeccionVisual)
              : "none";
            const tightnessAlertLevel = record.activo
              ? getTightnessTestAlertLevel(record.technicalSheet?.fechaProximaPruebaHermeticidad)
              : "none";
            const internalVisualAlertLevel = record.activo
              ? getInternalVisualInspectionAlertLevel(
                  record.technicalSheet?.fechaProximaInspeccionVisualInterna
                )
              : "none";
            const hydrostaticAlertLevel = record.activo
              ? getHydrostaticTestAlertLevel(record.technicalSheet?.fechaProximaPruebaHidrostatica)
              : "none";
            const extinguisherAlertLevel = record.activo
              ? getExtinguisherAlertLevel(
                  record.technicalSheet?.calidadExtintor,
                  record.technicalSheet?.fechaCalidadMalaExtintor
                )
              : "none";
            const maintenanceAlertLevel = record.activo
              ? getMaintenanceAlertLevel(record.technicalSheet?.fechaProximoMantenimiento)
              : "none";
            const valveDates = {
              fechaFabricacionValvulaLlenado: record.technicalSheet?.fechaFabricacionValvulaLlenado,
              fechaFabricacionValvulaServicio: record.technicalSheet?.fechaFabricacionValvulaServicio,
              fechaFabricacionValvulaMaximoLlenado:
                record.technicalSheet?.fechaFabricacionValvulaMaximoLlenado,
              fechaFabricacionValvulaAlivio: record.technicalSheet?.fechaFabricacionValvulaAlivio,
            };
            const valveAlertLevel = record.activo ? getValveAlertLevel(valveDates) : "none";
            const valveVencimiento = getValveVencimiento(valveDates);
            const hoseAlertLevel = record.activo
              ? getHoseAlertLevel(record.technicalSheet?.fechaFabricacionManguera)
              : "none";
            const hoseVencimiento = getHoseVencimiento(record.technicalSheet?.fechaFabricacionManguera);
            return (
              <Fragment key={record.id}>
                {isFirstInactive && (
                  <tr aria-hidden="true">
                    <td colSpan={4} className="bg-gray-100 px-4 py-3 border-t-4 border-gray-200">
                      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Dadas de baja
                      </span>
                    </td>
                  </tr>
                )}
                <tr
                className={`border-t border-gray-100 hover:bg-gray-50 ${
                  !record.activo
                    ? "bg-orange-50"
                    : worstRowStyle(
                        alertLevel,
                        visualAlertLevel,
                        tightnessAlertLevel,
                        internalVisualAlertLevel,
                        hydrostaticAlertLevel,
                        extinguisherAlertLevel,
                        maintenanceAlertLevel,
                        valveAlertLevel,
                        hoseAlertLevel
                      )
                }`}
              >
                <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
                  <Link href={`/ciudades/${citySlug}/vehiculo/${record.id}`} className="hover:underline">
                    {record.numeroEconomico}
                  </Link>
                  {anterior && <span className="ml-1 font-normal text-gray-400">({anterior})</span>}
                  {!record.activo && (
                    <span className="ml-2 rounded-full border border-orange-400 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800">
                      Dado de baja
                    </span>
                  )}
                  {alertLevel !== "none" && record.technicalSheet?.fechaProximoUltrasonido && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${ultrasoundAlertBadgeStyles[alertLevel]}`}
                    >
                      {ultrasoundAlertLabel(alertLevel, record.technicalSheet.fechaProximoUltrasonido)}
                    </span>
                  )}
                  {visualAlertLevel !== "none" && record.technicalSheet?.fechaProximaInspeccionVisual && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${visualInspectionAlertBadgeStyles[visualAlertLevel]}`}
                    >
                      {visualInspectionAlertLabel(
                        visualAlertLevel,
                        record.technicalSheet.fechaProximaInspeccionVisual
                      )}
                    </span>
                  )}
                  {tightnessAlertLevel !== "none" &&
                    record.technicalSheet?.fechaProximaPruebaHermeticidad && (
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${tightnessTestAlertBadgeStyles[tightnessAlertLevel]}`}
                      >
                        {tightnessTestAlertLabel(
                          tightnessAlertLevel,
                          record.technicalSheet.fechaProximaPruebaHermeticidad
                        )}
                      </span>
                    )}
                  {internalVisualAlertLevel !== "none" &&
                    record.technicalSheet?.fechaProximaInspeccionVisualInterna && (
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${internalVisualInspectionAlertBadgeStyles[internalVisualAlertLevel]}`}
                      >
                        {internalVisualInspectionAlertLabel(
                          internalVisualAlertLevel,
                          record.technicalSheet.fechaProximaInspeccionVisualInterna
                        )}
                      </span>
                    )}
                  {hydrostaticAlertLevel !== "none" &&
                    record.technicalSheet?.fechaProximaPruebaHidrostatica && (
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${hydrostaticTestAlertBadgeStyles[hydrostaticAlertLevel]}`}
                      >
                        {hydrostaticTestAlertLabel(
                          hydrostaticAlertLevel,
                          record.technicalSheet.fechaProximaPruebaHidrostatica
                        )}
                      </span>
                    )}
                  {extinguisherAlertLevel !== "none" && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${extinguisherAlertBadgeStyles[extinguisherAlertLevel]}`}
                    >
                      {extinguisherAlertLabel(
                        extinguisherAlertLevel,
                        record.technicalSheet?.fechaCalidadMalaExtintor
                      )}
                    </span>
                  )}
                  {maintenanceAlertLevel !== "none" && record.technicalSheet?.fechaProximoMantenimiento && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${maintenanceAlertBadgeStyles[maintenanceAlertLevel]}`}
                    >
                      {maintenanceAlertLabel(
                        maintenanceAlertLevel,
                        record.technicalSheet.fechaProximoMantenimiento,
                        record.technicalSheet.kilometrajeProximoMantenimiento
                      )}
                    </span>
                  )}
                  {valveAlertLevel !== "none" && valveVencimiento && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${valveAlertBadgeStyles[valveAlertLevel]}`}
                    >
                      {valveAlertLabel(valveAlertLevel, valveVencimiento)}
                    </span>
                  )}
                  {hoseAlertLevel !== "none" && hoseVencimiento && (
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${hoseAlertBadgeStyles[hoseAlertLevel]}`}
                    >
                      {hoseAlertLabel(hoseAlertLevel, hoseVencimiento)}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{record.sucursal}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{record.anio}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{record.placas}</td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
