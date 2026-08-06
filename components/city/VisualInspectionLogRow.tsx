"use client";

import { useState } from "react";
import type { VisualInspectionLog, Document } from "@prisma/client";
import { deleteVisualInspectionLog } from "@/actions/visual-inspection-actions";
import { formatDate } from "@/lib/dates";
import { DocumentList } from "./DocumentList";
import { UploadVisualInspectionLogDocumentForm } from "@/components/admin/UploadVisualInspectionLogDocumentForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

type VisualInspectionLogWithDocuments = VisualInspectionLog & { documents: Document[] };

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function VisualInspectionLogRow({
  log,
  canEdit,
  isAdmin,
}: {
  log: VisualInspectionLogWithDocuments;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="text-sm text-ink">
          <span className="font-medium text-primary">{formatDate(log.fechaRealizacion)}</span>
          {log.compania && <>{" · "}{log.compania}</>}
        </span>
        <span className="text-xs text-primary">{expanded ? "Ocultar" : "Ver detalle"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 border-t border-gray-100 pt-3 text-sm text-ink">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Compañía" value={log.compania} />
            <Field label="Número de inspección" value={log.numeroInspeccion} />
            <Field label="Responsable" value={log.responsable} />
            <Field
              label="Última fecha de inspección visual externa"
              value={log.fechaUltimaInspeccion ? formatDate(log.fechaUltimaInspeccion) : null}
            />
            <Field label="Fecha de realización" value={formatDate(log.fechaRealizacion)} />
            <Field label="Fecha de la próxima inspección" value={formatDate(log.fechaProximaInspeccion)} />
          </dl>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Documentos (PDF o imagen)
            </p>
            <div className="space-y-2">
              {canEdit && <UploadVisualInspectionLogDocumentForm visualInspectionLogId={log.id} />}
              <DocumentList documents={log.documents} isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <form action={deleteVisualInspectionLog.bind(null, log.id)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Eliminar este registro de inspección visual externa (${formatDate(log.fechaRealizacion)})? También se eliminarán sus documentos.`}
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
