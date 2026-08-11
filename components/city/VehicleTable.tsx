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
import { isAlertVisibleForSection } from "@/lib/alert-visibility";
import { calidadMantenimientoLabels, calidadMantenimientoStyles, type CalidadMantenimiento } from "@/lib/vehicle-enums";
import { getVehicleSemaforoLevel, semaforoDotStyles, semaforoLabels } from "@/lib/vehicle-semaforo";

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
  sectionSlug,
}: {
  records: VehicleRecordWithSheet[];
  citySlug: string;
  sectionSlug: string;
}) {
  // "Estaciones de carburación" (ver scripts/add-estaciones-de-carburacion.mjs)
  // no es un vehículo: reutiliza numeroEconomico/sucursal como
  // "Nombre"/"Dirección" y no tiene año/placas (ver components/admin/VehicleForm.tsx).
  const isEstacion = sectionSlug === "estaciones-de-carburacion";

  if (records.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        {isEstacion
          ? "Todavía no hay estaciones registradas en este apartado."
          : "Todavía no hay números económicos registrados en este apartado."}
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-2 py-2" title="Semáforo de vencimientos próximos" aria-label="Semáforo">
              <span className="sr-only">Estado</span>
            </th>
            <th className="whitespace-nowrap px-4 py-2">{isEstacion ? "Nombre" : "Número económico"}</th>
            <th className="whitespace-nowrap px-4 py-2">{isEstacion ? "Dirección" : "Sucursal"}</th>
            {!isEstacion && (
              <>
                <th className="whitespace-nowrap px-4 py-2">Año</th>
                <th className="whitespace-nowrap px-4 py-2">Placas</th>
              </>
            )}
            <th className="whitespace-nowrap px-4 py-2">Número de serie</th>
            <th className="whitespace-nowrap px-4 py-2">Calidad</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record, index) => {
            const isFirstInactive = !record.activo && (index === 0 || records[index - 1].activo);
            const anterior = formatAnterior(record);
            const alertLevel = record.activo && isAlertVisibleForSection("ultrasonido", sectionSlug)
              ? getUltrasoundAlertLevel(record.technicalSheet?.fechaProximoUltrasonido)
              : "none";
            const visualAlertLevel = record.activo && isAlertVisibleForSection("visualExterna", sectionSlug)
              ? getVisualInspectionAlertLevel(record.technicalSheet?.fechaProximaInspeccionVisual)
              : "none";
            const tightnessAlertLevel = record.activo && isAlertVisibleForSection("hermeticidad", sectionSlug)
              ? getTightnessTestAlertLevel(record.technicalSheet?.fechaProximaPruebaHermeticidad)
              : "none";
            const internalVisualAlertLevel = record.activo && isAlertVisibleForSection("visualInterna", sectionSlug)
              ? getInternalVisualInspectionAlertLevel(
                  record.technicalSheet?.fechaProximaInspeccionVisualInterna
                )
              : "none";
            const hydrostaticAlertLevel = record.activo && isAlertVisibleForSection("hidrostatica", sectionSlug)
              ? getHydrostaticTestAlertLevel(record.technicalSheet?.fechaProximaPruebaHidrostatica)
              : "none";
            const extinguisherAlertLevel = record.activo && isAlertVisibleForSection("extintor", sectionSlug)
              ? getExtinguisherAlertLevel(
                  record.technicalSheet?.calidadExtintor,
                  record.technicalSheet?.fechaCalidadMalaExtintor
                )
              : "none";
            const maintenanceAlertLevel = record.activo && isAlertVisibleForSection("mantenimiento", sectionSlug)
              ? getMaintenanceAlertLevel(record.technicalSheet?.fechaProximoMantenimiento)
              : "none";
            const valveDates = {
              fechaFabricacionValvulaLlenado: record.technicalSheet?.fechaFabricacionValvulaLlenado,
              fechaFabricacionValvulaNoRetroceso:
                record.technicalSheet?.fechaFabricacionValvulaNoRetroceso,
              fechaFabricacionValvulaBypass: record.technicalSheet?.fechaFabricacionValvulaBypass,
              fechaFabricacionValvulaRetornoVapores:
                record.technicalSheet?.fechaFabricacionValvulaRetornoVapores,
              fechaFabricacionValvulaServicio: record.technicalSheet?.fechaFabricacionValvulaServicio,
              fechaFabricacionValvulaMaximoLlenado:
                record.technicalSheet?.fechaFabricacionValvulaMaximoLlenado,
              fechaFabricacionValvulaMaximoLlenado85:
                record.technicalSheet?.fechaFabricacionValvulaMaximoLlenado85,
              fechaFabricacionValvulaAlivio: record.technicalSheet?.fechaFabricacionValvulaAlivio,
              fechaFabricacionValvulaDescargaEmergencia:
                record.technicalSheet?.fechaFabricacionValvulaDescargaEmergencia,
            };
            const valveAlertLevel =
              record.activo && isAlertVisibleForSection("valvulas", sectionSlug)
                ? getValveAlertLevel(valveDates)
                : "none";
            const valveVencimiento = getValveVencimiento(valveDates);
            const hoseAlertLevel = record.activo && isAlertVisibleForSection("mangueras", sectionSlug)
              ? getHoseAlertLevel(record.technicalSheet?.fechaFabricacionManguera)
              : "none";
            const hoseVencimiento = getHoseVencimiento(record.technicalSheet?.fechaFabricacionManguera);
            const semaforoLevel = record.activo
              ? getVehicleSemaforoLevel(record.technicalSheet, sectionSlug)
              : "none";
            return (
              <Fragment key={record.id}>
                {isFirstInactive && (
                  <tr aria-hidden="true">
                    <td colSpan={isEstacion ? 5 : 7} className="bg-gray-100 px-4 py-3 border-t-4 border-gray-200">
                      <span className="text-xs font-semibold uppercase text-gray-500">
                        Dadas de baja
                      </span>
                    </td>
                  </tr>
                )}
                <tr
                className={`relative border-t border-gray-100 hover:bg-gray-50 ${
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
                <td className="whitespace-nowrap px-2 py-2">
                  {semaforoLevel !== "none" && (
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${semaforoDotStyles[semaforoLevel]}`}
                      title={semaforoLabels[semaforoLevel]}
                    />
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 font-medium text-primary">
                  {/* Estira el link a toda la fila (no solo esta celda): "tr" es
                      "relative" y este link "absolute inset-0" toma su tamaño
                      completo. El link visible de abajo sigue ahí para que el
                      texto se vea subrayado/enfocable como antes. */}
                  <Link
                    href={`/ciudades/${citySlug}/vehiculo/${record.id}`}
                    className="absolute inset-0"
                    aria-label={record.numeroEconomico}
                  />
                  <Link
                    href={`/ciudades/${citySlug}/vehiculo/${record.id}`}
                    className="relative hover:underline"
                    tabIndex={-1}
                  >
                    {record.numeroEconomico}
                  </Link>
                  {anterior && <span className="ml-1 font-normal text-gray-400">({anterior})</span>}
                  {!record.activo && (
                    <span
                      className="ml-2 rounded-full border border-orange-400 bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-800"
                      title={record.motivoBaja ? `Motivo: ${record.motivoBaja}` : undefined}
                    >
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
                {!isEstacion && (
                  <>
                    <td className="whitespace-nowrap px-4 py-2 text-ink">{record.anio}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-ink">{record.placas}</td>
                  </>
                )}
                <td className="whitespace-nowrap px-4 py-2 text-ink">{record.technicalSheet?.serie || "—"}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  {record.calidad && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${calidadMantenimientoStyles[record.calidad as CalidadMantenimiento]}`}
                    >
                      {calidadMantenimientoLabels[record.calidad as CalidadMantenimiento]}
                    </span>
                  )}
                </td>
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
