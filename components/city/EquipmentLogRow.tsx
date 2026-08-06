"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { EquipmentLog, Document } from "@prisma/client";
import { deleteEquipmentLog, updateEquipmentLog } from "@/actions/equipment-log-actions";
import type { ActionState } from "@/actions/user-actions";
import { equipmentLogTipoOptions } from "@/lib/equipo-enums";
import { formatDate, toDateInputValue } from "@/lib/dates";
import { DocumentList } from "./DocumentList";
import { UploadEquipmentLogDocumentForm } from "@/components/admin/UploadEquipmentLogDocumentForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

const initialState: ActionState = {};

type EquipmentLogWithDocuments = EquipmentLog & { documents: Document[] };

const inputClass =
  "w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

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

function EditEquipmentLogForm({ log }: { log: EquipmentLog }) {
  const action = updateEquipmentLog.bind(null, log.id);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`tipo-${log.id}`}>
            Tipo de mantenimiento
          </label>
          <select id={`tipo-${log.id}`} name="tipoMantenimiento" defaultValue={log.tipoMantenimiento} className={inputClass}>
            {equipmentLogTipoOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
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
          <input
            id={`responsable-${log.id}`}
            name="responsable"
            defaultValue={log.responsable ?? ""}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`descripcion-${log.id}`}>
          Descripción
        </label>
        <textarea
          id={`descripcion-${log.id}`}
          name="descripcion"
          rows={2}
          defaultValue={log.descripcion}
          className={inputClass}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`observacion-${log.id}`}>
          Observación
        </label>
        <textarea
          id={`observacion-${log.id}`}
          name="observacion"
          rows={2}
          defaultValue={log.observacion ?? ""}
          className={inputClass}
        />
      </div>
      {log.tipoMantenimiento === "Cambio" && (
        <p className="text-xs text-gray-500">
          Este registro ya se aplicó como "Cambio" (dio de baja el equipo y creó uno nuevo).
          Cambiarle el tipo aquí no deshace ni repite ese efecto, solo corrige el dato.
        </p>
      )}
      <SubmitButton />
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="text-xs text-green-700">{state.success}</p>}
    </form>
  );
}

export function EquipmentLogRow({
  log,
  canEdit,
  isAdmin,
}: {
  log: EquipmentLogWithDocuments;
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
          {log.tipoMantenimiento} — {log.descripcion}
        </span>
        <span className="text-xs text-primary">{expanded ? "Ocultar" : "Ver detalle"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-4 border-t border-gray-100 pt-3 text-sm text-ink">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">Responsable</dt>
              <dd>{log.responsable || "—"}</dd>
            </div>
            {log.observacion && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-semibold uppercase text-gray-500">Observación</dt>
                <dd>{log.observacion}</dd>
              </div>
            )}
          </dl>

          {isAdmin && <EditEquipmentLogForm log={log} />}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Documentos (PDF o imagen)</p>
            <div className="space-y-2">
              {canEdit && <UploadEquipmentLogDocumentForm equipmentLogId={log.id} />}
              <DocumentList documents={log.documents} isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <form action={deleteEquipmentLog.bind(null, log.id)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Eliminar este registro de bitácora (${formatDate(log.fecha)})? También se eliminarán sus documentos.`}
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
