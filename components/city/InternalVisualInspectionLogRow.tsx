"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { InternalVisualInspectionLog, Document } from "@prisma/client";
import {
  deleteInternalVisualInspectionLog,
  updateInternalVisualInspectionLog,
} from "@/actions/internal-visual-inspection-actions";
import type { ActionState } from "@/actions/user-actions";
import { formatDate, toDateInputValue } from "@/lib/dates";
import { DocumentList } from "./DocumentList";
import { UploadInternalVisualInspectionLogDocumentForm } from "@/components/admin/UploadInternalVisualInspectionLogDocumentForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

const initialState: ActionState = {};

type LogWithDocuments = InternalVisualInspectionLog & { documents: Document[] };

const inputClass =
  "w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Actualizar"}
    </button>
  );
}

function EditInternalVisualInspectionLogForm({ log }: { log: InternalVisualInspectionLog }) {
  const action = updateInternalVisualInspectionLog.bind(null, log.id);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`compania-${log.id}`}>
            Compañía
          </label>
          <input id={`compania-${log.id}`} name="compania" defaultValue={log.compania ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`numeroInspeccion-${log.id}`}>
            Número de inspección
          </label>
          <input
            id={`numeroInspeccion-${log.id}`}
            name="numeroInspeccion"
            defaultValue={log.numeroInspeccion ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`responsable-${log.id}`}>
            Responsable
          </label>
          <input id={`responsable-${log.id}`} name="responsable" defaultValue={log.responsable ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaUltimaInspeccion-${log.id}`}>
            Última fecha de inspección visual interna
          </label>
          <input
            id={`fechaUltimaInspeccion-${log.id}`}
            name="fechaUltimaInspeccion"
            type="date"
            defaultValue={toDateInputValue(log.fechaUltimaInspeccion)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaRealizacion-${log.id}`}>
            Fecha de realización
          </label>
          <input
            id={`fechaRealizacion-${log.id}`}
            name="fechaRealizacion"
            type="date"
            defaultValue={toDateInputValue(log.fechaRealizacion)}
            className={inputClass}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Esto solo corrige este registro; no vuelve a actualizar la ficha técnica ni recalcula la
        fecha próxima.
      </p>
      <SubmitButton />
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="text-xs text-green-700">{state.success}</p>}
    </form>
  );
}

export function InternalVisualInspectionLogRow({
  log,
  canEdit,
  isAdmin,
}: {
  log: LogWithDocuments;
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
              label="Última fecha de inspección visual interna"
              value={log.fechaUltimaInspeccion ? formatDate(log.fechaUltimaInspeccion) : null}
            />
            <Field label="Fecha de realización" value={formatDate(log.fechaRealizacion)} />
          </dl>

          {isAdmin && <EditInternalVisualInspectionLogForm log={log} />}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Documentos (PDF o imagen)
            </p>
            <div className="space-y-2">
              {canEdit && (
                <UploadInternalVisualInspectionLogDocumentForm internalVisualInspectionLogId={log.id} />
              )}
              <DocumentList documents={log.documents} isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <form action={deleteInternalVisualInspectionLog.bind(null, log.id)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Eliminar este registro de inspección visual interna (${formatDate(log.fechaRealizacion)})? También se eliminarán sus documentos.`}
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
