import { complianceAmbitoLabels } from "@/lib/compliance-checklist";
import type { ComplianceOverviewRow } from "@/lib/compliance-stats";
import { ComplianceGauge } from "./ComplianceGauge";

// Solo se muestra en Administración (ciudad agregada, ver
// lib/aggregate-city.ts): el mismo medidor de cumplimiento que trae cada
// unidad/estación/planta, pero promediado por ámbito entre todas las
// ciudades reales.
export function ComplianceOverviewPanel({ rows }: { rows: ComplianceOverviewRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
        Cumplimiento de normatividad
      </h2>
      <div className="flex flex-wrap gap-8">
        {rows.map((row) => (
          <div key={row.ambito} className="flex flex-col items-center gap-2">
            <ComplianceGauge porcentaje={row.promedio} />
            <p className="text-center text-sm font-medium text-ink">
              {complianceAmbitoLabels[row.ambito]}
              <span className="ml-1 text-xs font-normal text-gray-500">({row.total})</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
