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
          {records.map((record) => {
            const anterior = formatAnterior(record);
            const alertLevel = record.activo
              ? getUltrasoundAlertLevel(record.technicalSheet?.fechaProximoUltrasonido)
              : "none";
            const visualAlertLevel = record.activo
              ? getVisualInspectionAlertLevel(record.technicalSheet?.fechaProximaInspeccionVisual)
              : "none";
            return (
              <tr
                key={record.id}
                className={`border-t border-gray-100 hover:bg-gray-50 ${!record.activo ? "bg-orange-50" : worstRowStyle(alertLevel, visualAlertLevel)}`}
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
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{record.sucursal}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{record.anio}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{record.placas}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
