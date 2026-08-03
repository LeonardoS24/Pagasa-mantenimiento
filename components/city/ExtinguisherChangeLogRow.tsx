"use client";

import { useState } from "react";
import type { ExtinguisherChangeLog, Document } from "@prisma/client";
import { deleteExtinguisherChangeLog } from "@/actions/extinguisher-actions";
import { formatDate } from "@/lib/dates";
import { calidadExtintorLabels, type CalidadExtintor } from "@/lib/vehicle-enums";
import { DocumentList } from "./DocumentList";
import { UploadExtinguisherChangeLogDocumentForm } from "@/components/admin/UploadExtinguisherChangeLogDocumentForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

type ExtinguisherChangeLogWithDocuments = ExtinguisherChangeLog & { documents: Document[] };

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function ExtinguisherChangeLogRow({
  log,
  canEdit,
  isAdmin,
}: {
  log: ExtinguisherChangeLogWithDocuments;
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
          {" · "}
          {calidadExtintorLabels[log.calidad as CalidadExtintor]}
        </span>
        <span className="text-xs text-primary">{expanded ? "Ocultar" : "Ver detalle"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 border-t border-gray-100 pt-3 text-sm text-ink">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Responsable" value={log.responsable} />
            <Field label="Fecha de instalación" value={formatDate(log.fechaInstalacion)} />
            <Field label="Fecha de vencimiento" value={formatDate(log.fechaVencimiento)} />
            <Field label="Calidad" value={calidadExtintorLabels[log.calidad as CalidadExtintor]} />
            <Field label="Fecha de realización" value={formatDate(log.fechaRealizacion)} />
          </dl>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Documentos (PDF)
            </p>
            <div className="space-y-2">
              {canEdit && (
                <UploadExtinguisherChangeLogDocumentForm extinguisherChangeLogId={log.id} />
              )}
              <DocumentList documents={log.documents} isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <form action={deleteExtinguisherChangeLog.bind(null, log.id)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Eliminar este registro de cambio de extintor (${formatDate(log.fechaRealizacion)})? También se eliminarán sus documentos.`}
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
