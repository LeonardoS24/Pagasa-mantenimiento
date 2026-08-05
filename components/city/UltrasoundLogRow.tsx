"use client";

import { useState } from "react";
import type { UltrasoundLog, Document } from "@prisma/client";
import { deleteUltrasoundLog } from "@/actions/ultrasound-actions";
import { formatDate } from "@/lib/dates";
import { DocumentList } from "./DocumentList";
import { UploadUltrasoundLogDocumentForm } from "@/components/admin/UploadUltrasoundLogDocumentForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

type UltrasoundLogWithDocuments = UltrasoundLog & { documents: Document[] };

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function UltrasoundLogRow({
  log,
  canEdit,
  isAdmin,
}: {
  log: UltrasoundLogWithDocuments;
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
            <Field label="Número de ultrasonido" value={log.numeroUltrasonido} />
            <Field label="Responsable" value={log.responsable} />
            <Field
              label="Última fecha de ultrasonido"
              value={log.fechaUltimoUltrasonido ? formatDate(log.fechaUltimoUltrasonido) : null}
            />
            <Field label="Fecha de realización" value={formatDate(log.fechaRealizacion)} />
          </dl>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Documentos (PDF)
            </p>
            <div className="space-y-2">
              {canEdit && <UploadUltrasoundLogDocumentForm ultrasoundLogId={log.id} />}
              <DocumentList documents={log.documents} isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <form action={deleteUltrasoundLog.bind(null, log.id)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Eliminar este registro de ultrasonido (${formatDate(log.fechaRealizacion)})? También se eliminarán sus documentos.`}
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
