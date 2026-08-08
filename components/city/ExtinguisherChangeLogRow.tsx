"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ExtinguisherChangeLog, Document } from "@prisma/client";
import { deleteExtinguisherChangeLog, updateExtinguisherChangeLog } from "@/actions/extinguisher-actions";
import type { ActionState } from "@/actions/user-actions";
import { formatDate, toDateInputValue } from "@/lib/dates";
import { calidadExtintorLabels, type CalidadExtintor } from "@/lib/vehicle-enums";
import { DocumentList } from "./DocumentList";
import { UploadExtinguisherChangeLogDocumentForm } from "@/components/admin/UploadExtinguisherChangeLogDocumentForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

const initialState: ActionState = {};

type ExtinguisherChangeLogWithDocuments = ExtinguisherChangeLog & { documents: Document[] };

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

function EditExtinguisherChangeLogForm({ log }: { log: ExtinguisherChangeLog }) {
  const action = updateExtinguisherChangeLog.bind(null, log.id);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`responsable-${log.id}`}>
            Responsable
          </label>
          <input id={`responsable-${log.id}`} name="responsable" defaultValue={log.responsable ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaInstalacion-${log.id}`}>
            Fecha de instalación
          </label>
          <input
            id={`fechaInstalacion-${log.id}`}
            name="fechaInstalacion"
            type="date"
            defaultValue={toDateInputValue(log.fechaInstalacion)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaVencimiento-${log.id}`}>
            Fecha de vencimiento
          </label>
          <input
            id={`fechaVencimiento-${log.id}`}
            name="fechaVencimiento"
            type="date"
            defaultValue={toDateInputValue(log.fechaVencimiento)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`calidad-${log.id}`}>
            Calidad
          </label>
          <select id={`calidad-${log.id}`} name="calidad" defaultValue={log.calidad} className={inputClass}>
            {Object.entries(calidadExtintorLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Esto solo corrige este registro; no vuelve a actualizar la ficha técnica (la calidad
        vigente de la unidad se controla directo ahí).
      </p>
      <SubmitButton />
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="text-xs text-green-700">{state.success}</p>}
    </form>
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
          <span className="font-medium text-primary">{formatDate(log.fechaInstalacion)}</span>
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
          </dl>

          {isAdmin && <EditExtinguisherChangeLogForm log={log} />}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Documentos (PDF o imagen)
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
                confirmMessage={`¿Eliminar este registro de cambio de extintor (${formatDate(log.fechaInstalacion)})? También se eliminarán sus documentos.`}
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
