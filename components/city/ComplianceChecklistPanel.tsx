import type { ComplianceChecklistItem } from "@prisma/client";
import {
  complianceItemsFor,
  compliancePercentage,
  complianceAmbitoLabels,
  type ComplianceAmbito,
} from "@/lib/compliance-checklist";
import { ComplianceGauge } from "./ComplianceGauge";
import { ComplianceChecklistRow } from "@/components/admin/ComplianceChecklistRow";

// Checklist de cumplimiento de normatividad: lista fija de documentos según
// el tipo de registro (ver lib/compliance-checklist.ts), con su medidor de
// porcentaje arriba. Cuando la unidad está dada de baja se suma el "Reporte
// de término de operaciones" a la lista de Unidad. Es solo un checklist —
// no se sube ningún archivo aquí, solo se marca si se tiene o no.
export function ComplianceChecklistPanel({
  vehicleId,
  ambito,
  activo,
  filas,
  isEditor,
}: {
  vehicleId: string;
  ambito: ComplianceAmbito;
  activo: boolean;
  filas: ComplianceChecklistItem[];
  isEditor: boolean;
}) {
  const items = complianceItemsFor(ambito, activo);
  const porcentaje = compliancePercentage(items, filas);
  const filasPorClave = new Map(filas.map((f) => [f.clave, f]));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase text-primary-bright">
            Cumplimiento de normatividad
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Documentos exigidos para {complianceAmbitoLabels[ambito].toLowerCase()}.
          </p>
        </div>
        <ComplianceGauge porcentaje={porcentaje} />
      </div>

      <ul className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {items.map((item) => (
          <ComplianceChecklistRow
            key={item.clave}
            vehicleId={vehicleId}
            item={item}
            fila={filasPorClave.get(item.clave) ?? null}
            isEditor={isEditor}
          />
        ))}
      </ul>
    </div>
  );
}
