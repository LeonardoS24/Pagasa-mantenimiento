"use client";

import { useState } from "react";
import type { ValveCorrectiveMaintenanceLog, Document } from "@prisma/client";
import { deleteValveCorrectiveMaintenanceLog } from "@/actions/valve-corrective-maintenance-actions";
import { formatDate } from "@/lib/dates";
import { valvulaCorrectivaLabels, type ValvulaCorrectiva } from "@/lib/valve-alerts";
import { DocumentList } from "./DocumentList";
import { UploadValveCorrectiveMaintenanceLogDocumentForm } from "@/components/admin/UploadValveCorrectiveMaintenanceLogDocumentForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

type ValveCorrectiveMaintenanceLogWithDocuments = ValveCorrectiveMaintenanceLog & {
  documents: Document[];
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function ValveCorrectiveMaintenanceLogRow({
  log,
  canEdit,
  isAdmin,
}: {
  log: ValveCorrectiveMaintenanceLogWithDocuments;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const valvulaLabel = valvulaCorrectivaLabels[log.valvula as ValvulaCorrectiva] ?? log.valvula;

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="text-sm text-ink">
          <span className="font-medium text-primary">{formatDate(log.fecha)}</span>
          {" · "}
          {valvulaLabel}
        </span>
        <span className="text-xs text-primary">{expanded ? "Ocultar" : "Ver detalle"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 border-t border-gray-100 pt-3 text-sm text-ink">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Válvula afectada" value={valvulaLabel} />
            <Field label="Fecha" value={formatDate(log.fecha)} />
            <Field label="Responsable" value={log.responsable} />
          </dl>
          <div>
            <dt className="text-xs font-semibold uppercase text-gray-500">
              Descripción de la reparación
            </dt>
            <dd className="text-ink">{log.descripcion}</dd>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Documentos (PDF)
            </p>
            <div className="space-y-2">
              {canEdit && (
                <UploadValveCorrectiveMaintenanceLogDocumentForm
                  valveCorrectiveMaintenanceLogId={log.id}
                />
              )}
              <DocumentList documents={log.documents} isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <form action={deleteValveCorrectiveMaintenanceLog.bind(null, log.id)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Eliminar este registro de mantenimiento correctivo (${formatDate(log.fecha)})? También se eliminarán sus documentos.`}
                className="text-sm text-accent hover:underline"
              >
                Eliminar registro
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
