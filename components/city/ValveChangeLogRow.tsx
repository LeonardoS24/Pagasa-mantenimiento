"use client";

import { useState } from "react";
import type { ValveChangeLog, Document } from "@prisma/client";
import { deleteValveChangeLog } from "@/actions/valve-actions";
import { formatDate } from "@/lib/dates";
import { DocumentList } from "./DocumentList";
import { UploadValveChangeLogDocumentForm } from "@/components/admin/UploadValveChangeLogDocumentForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

type ValveChangeLogWithDocuments = ValveChangeLog & { documents: Document[] };

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

export function ValveChangeLogRow({
  log,
  canEdit,
  isAdmin,
}: {
  log: ValveChangeLogWithDocuments;
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
          <span className="font-medium text-primary">{formatDate(log.fechaInstalacion)}</span>
          {log.responsable && <>{" · "}{log.responsable}</>}
        </span>
        <span className="text-xs text-primary">{expanded ? "Ocultar" : "Ver detalle"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 border-t border-gray-100 pt-3 text-sm text-ink">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Responsable" value={log.responsable} />
            <Field label="Fecha de instalación" value={formatDate(log.fechaInstalacion)} />
            <Field
              label="Válvula de llenado"
              value={formatDate(log.fechaFabricacionValvulaLlenado)}
            />
            <Field
              label="Válvula de servicio"
              value={formatDate(log.fechaFabricacionValvulaServicio)}
            />
            <Field
              label="Válvula de máximo llenado"
              value={formatDate(log.fechaFabricacionValvulaMaximoLlenado)}
            />
            <Field
              label="Válvula de alivio (seguridad)"
              value={formatDate(log.fechaFabricacionValvulaAlivio)}
            />
          </dl>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Documentos (PDF)
            </p>
            <div className="space-y-2">
              {canEdit && <UploadValveChangeLogDocumentForm valveChangeLogId={log.id} />}
              <DocumentList documents={log.documents} isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <form action={deleteValveChangeLog.bind(null, log.id)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Eliminar este registro de cambio de válvulas (${formatDate(log.fechaInstalacion)})? También se eliminarán sus documentos.`}
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
