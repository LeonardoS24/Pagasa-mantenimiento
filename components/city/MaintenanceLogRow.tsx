"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { MaintenanceLog, Document } from "@prisma/client";
import { updateMaintenanceLog, deleteMaintenanceLog } from "@/actions/maintenance-actions";
import type { ActionState } from "@/actions/user-actions";
import {
  maintenanceStatusLabels,
  maintenanceStatusStyles,
  type MaintenanceStatus,
} from "@/lib/vehicle-enums";
import { formatDate } from "@/lib/dates";
import { DocumentList } from "./DocumentList";
import { UploadMaintenanceLogDocumentForm } from "@/components/admin/UploadMaintenanceLogDocumentForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

const initialState: ActionState = {};

type MaintenanceLogWithDocuments = MaintenanceLog & { documents: Document[] };

function StatusBadge({ status }: { status: string }) {
  const key = status as MaintenanceStatus;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${maintenanceStatusStyles[key]}`}>
      {maintenanceStatusLabels[key] ?? status}
    </span>
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

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function EditStatusForm({ log }: { log: MaintenanceLog }) {
  const action = updateMaintenanceLog.bind(null, log.id);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`descripcion-${log.id}`}>
          Descripción
        </label>
        <textarea
          id={`descripcion-${log.id}`}
          name="descripcion"
          rows={2}
          defaultValue={log.descripcion ?? ""}
          className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`estatus-${log.id}`}>
            Estatus del proceso
          </label>
          <select
            id={`estatus-${log.id}`}
            name="estatus"
            defaultValue={log.estatus}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {Object.entries(maintenanceStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <SubmitButton />
      </div>
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="text-xs text-green-700">{state.success}</p>}
    </form>
  );
}

export function MaintenanceLogRow({
  log,
  canEdit,
  isAdmin,
}: {
  log: MaintenanceLogWithDocuments;
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
          <span className="font-medium text-primary">{formatDate(log.fecha)}</span>
          {" · "}
          {log.tipoMantenimiento} — {log.tipoServicio}
        </span>
        <span className="flex items-center gap-2">
          <StatusBadge status={log.estatus} />
          <span className="text-xs text-primary">{expanded ? "Ocultar" : "Ver detalle"}</span>
        </span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 border-t border-gray-100 pt-3 text-sm text-ink">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Tipo de mantenimiento" value={log.tipoMantenimiento} />
            <Field label="Tipo de servicio" value={log.tipoServicio} />
            <Field label="Fecha" value={formatDate(log.fecha)} />
            <Field label="Pieza" value={log.pieza} />
            <Field label="Cantidad" value={log.cantidad} />
            <Field label="Unidad" value={log.unidad} />
            <Field
              label="Estatus"
              value={maintenanceStatusLabels[log.estatus as MaintenanceStatus] ?? log.estatus}
            />
            <Field label="Nombre del operador" value={log.nombreOperador} />
            <Field label="Auxiliar técnico" value={log.auxiliarTecnico} />
            <Field label="Responsable del trabajo mecánico" value={log.responsableTrabajoMecanico} />
          </dl>

          <Field label="Descripción" value={log.descripcion} />
          <Field label="Observación" value={log.observacion} />

          {canEdit && <EditStatusForm log={log} />}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Documentos (PDF)
            </p>
            <div className="space-y-2">
              {canEdit && <UploadMaintenanceLogDocumentForm maintenanceLogId={log.id} />}
              <DocumentList documents={log.documents} isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <form action={deleteMaintenanceLog.bind(null, log.id)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Eliminar este mantenimiento (${log.tipoMantenimiento} — ${log.tipoServicio})? También se eliminarán sus documentos.`}
                className="text-sm text-accent hover:underline"
              >
                Eliminar mantenimiento
              </ConfirmSubmitButton>
            </form>
          )}
        </div>
      )}
    </li>
  );
}
