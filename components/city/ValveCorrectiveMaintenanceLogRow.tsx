"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ValveCorrectiveMaintenanceLog, Document } from "@prisma/client";
import {
  deleteValveCorrectiveMaintenanceLog,
  updateValveCorrectiveMaintenanceLog,
} from "@/actions/valve-corrective-maintenance-actions";
import type { ActionState } from "@/actions/user-actions";
import { formatDate, toDateInputValue } from "@/lib/dates";
import { getValvulaCorrectivaOptions, getValvulaCorrectivaLabel } from "@/lib/valve-alerts";
import { DocumentList } from "./DocumentList";
import { UploadValveCorrectiveMaintenanceLogDocumentForm } from "@/components/admin/UploadValveCorrectiveMaintenanceLogDocumentForm";
import { ConfirmDeleteRecordWithPassword } from "@/components/admin/ConfirmDeleteRecordWithPassword";

const initialState: ActionState = {};

type ValveCorrectiveMaintenanceLogWithDocuments = ValveCorrectiveMaintenanceLog & {
  documents: Document[];
};

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

function EditValveCorrectiveMaintenanceLogForm({
  log,
  sectionSlug,
}: {
  log: ValveCorrectiveMaintenanceLog;
  sectionSlug: string;
}) {
  const action = updateValveCorrectiveMaintenanceLog.bind(null, log.id);
  const [state, formAction] = useFormState(action, initialState);
  const valvulaOptions = getValvulaCorrectivaOptions(sectionSlug);

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`valvula-${log.id}`}>
            Válvula afectada
          </label>
          <select id={`valvula-${log.id}`} name="valvula" defaultValue={log.valvula} className={inputClass}>
            {valvulaOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fecha-${log.id}`}>
            Fecha
          </label>
          <input
            id={`fecha-${log.id}`}
            name="fecha"
            type="date"
            defaultValue={toDateInputValue(log.fecha)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`responsable-${log.id}`}>
            Responsable
          </label>
          <input id={`responsable-${log.id}`} name="responsable" defaultValue={log.responsable ?? ""} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`descripcion-${log.id}`}>
          Descripción de la reparación
        </label>
        <textarea
          id={`descripcion-${log.id}`}
          name="descripcion"
          rows={2}
          defaultValue={log.descripcion}
          className={inputClass}
        />
      </div>
      <p className="text-xs text-gray-500">Esto solo corrige este registro.</p>
      <SubmitButton />
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="text-xs text-green-700">{state.success}</p>}
    </form>
  );
}

export function ValveCorrectiveMaintenanceLogRow({
  log,
  canEdit,
  isAdmin,
  sectionSlug,
}: {
  log: ValveCorrectiveMaintenanceLogWithDocuments;
  canEdit: boolean;
  isAdmin: boolean;
  sectionSlug: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const valvulaLabel = getValvulaCorrectivaLabel(log.valvula, sectionSlug);

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

          {isAdmin && (
            <EditValveCorrectiveMaintenanceLogForm log={log} sectionSlug={sectionSlug} />
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Documentos (PDF o imagen)
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
            <ConfirmDeleteRecordWithPassword
              mensaje={`¿Eliminar este registro de mantenimiento correctivo (${formatDate(log.fecha)})? También se eliminarán sus documentos.`}
              action={deleteValveCorrectiveMaintenanceLog.bind(null, log.id)}
              className="text-sm text-accent hover:underline"
            >
              Eliminar registro
            </ConfirmDeleteRecordWithPassword>
          )}
        </div>
      )}
    </li>
  );
}
