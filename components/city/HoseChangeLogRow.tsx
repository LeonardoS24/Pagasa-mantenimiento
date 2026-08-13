"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { HoseChangeLog, Document } from "@prisma/client";
import { deleteHoseChangeLog, updateHoseChangeLog } from "@/actions/hose-actions";
import type { ActionState } from "@/actions/user-actions";
import { formatDate, toDateInputValue } from "@/lib/dates";
import { DocumentList } from "./DocumentList";
import { UploadHoseChangeLogDocumentForm } from "@/components/admin/UploadHoseChangeLogDocumentForm";
import { ConfirmDeleteRecordWithPassword } from "@/components/admin/ConfirmDeleteRecordWithPassword";

const initialState: ActionState = {};

type HoseChangeLogWithDocuments = HoseChangeLog & { documents: Document[] };

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

function EditHoseChangeLogForm({ log }: { log: HoseChangeLog }) {
  const action = updateHoseChangeLog.bind(null, log.id);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`responsable-${log.id}`}>
            Responsable
          </label>
          <input id={`responsable-${log.id}`} name="responsable" defaultValue={log.responsable ?? ""} className={inputClass} />
        </div>
        <div className="rounded-md border-2 border-primary/40 bg-primary/5 p-2">
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaInstalacion-${log.id}`}>
            Fecha de instalación de la manguera
          </label>
          <input
            id={`fechaInstalacion-${log.id}`}
            name="fechaInstalacion"
            type="date"
            defaultValue={toDateInputValue(log.fechaInstalacion)}
            className={inputClass}
          />
        </div>
      </div>
      <div className="max-w-xs">
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaFabricacionManguera-${log.id}`}>
          Fecha de fabricación de la manguera
        </label>
        <input
          id={`fechaFabricacionManguera-${log.id}`}
          name="fechaFabricacionManguera"
          type="date"
          defaultValue={toDateInputValue(log.fechaFabricacionManguera)}
          className={inputClass}
        />
      </div>
      <p className="text-xs text-gray-500">
        Esto solo corrige este registro; no vuelve a actualizar la ficha técnica.
      </p>
      <SubmitButton />
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="text-xs text-green-700">{state.success}</p>}
    </form>
  );
}

export function HoseChangeLogRow({
  log,
  canEdit,
  isAdmin,
}: {
  log: HoseChangeLogWithDocuments;
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
          <dl className="grid gap-3 sm:grid-cols-2">
            <Field label="Responsable" value={log.responsable} />
          </dl>
          <div className="mt-3 max-w-xs rounded-md border-2 border-primary/40 bg-primary/5 p-3">
            <dt className="text-xs font-semibold uppercase text-gray-500">
              Fecha de instalación de la manguera
            </dt>
            <dd className="text-ink">{formatDate(log.fechaInstalacion)}</dd>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Fecha de fabricación de la manguera"
              value={formatDate(log.fechaFabricacionManguera)}
            />
          </dl>

          {isAdmin && <EditHoseChangeLogForm log={log} />}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Documentos (PDF o imagen)
            </p>
            <div className="space-y-2">
              {canEdit && <UploadHoseChangeLogDocumentForm hoseChangeLogId={log.id} />}
              <DocumentList documents={log.documents} isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <ConfirmDeleteRecordWithPassword
              mensaje={`¿Eliminar este registro de cambio de mangueras (${formatDate(log.fechaInstalacion)})? También se eliminarán sus documentos.`}
              action={deleteHoseChangeLog.bind(null, log.id)}
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
