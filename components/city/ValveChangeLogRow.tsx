"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ValveChangeLog, Document } from "@prisma/client";
import { deleteValveChangeLog, updateValveChangeLog } from "@/actions/valve-actions";
import type { ActionState } from "@/actions/user-actions";
import { formatDate, toDateInputValue } from "@/lib/dates";
import { DocumentList } from "./DocumentList";
import { UploadValveChangeLogDocumentForm } from "@/components/admin/UploadValveChangeLogDocumentForm";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

const initialState: ActionState = {};

type ValveChangeLogWithDocuments = ValveChangeLog & { documents: Document[] };

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

function EditValveChangeLogForm({ log }: { log: ValveChangeLog }) {
  const action = updateValveChangeLog.bind(null, log.id);
  const [state, formAction] = useFormState(action, initialState);
  const [tieneValvula85, setTieneValvula85] = useState(log.tieneValvulaMaximoLlenado85);

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
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaFabricacionValvulaLlenado-${log.id}`}>
            Válvula de llenado
          </label>
          <input
            id={`fechaFabricacionValvulaLlenado-${log.id}`}
            name="fechaFabricacionValvulaLlenado"
            type="date"
            defaultValue={toDateInputValue(log.fechaFabricacionValvulaLlenado)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaFabricacionValvulaNoRetroceso-${log.id}`}>
            Válvula de no retroceso (check)
          </label>
          <input
            id={`fechaFabricacionValvulaNoRetroceso-${log.id}`}
            name="fechaFabricacionValvulaNoRetroceso"
            type="date"
            defaultValue={toDateInputValue(log.fechaFabricacionValvulaNoRetroceso)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaFabricacionValvulaBypass-${log.id}`}>
            Válvula de retroceso (bypass)
          </label>
          <input
            id={`fechaFabricacionValvulaBypass-${log.id}`}
            name="fechaFabricacionValvulaBypass"
            type="date"
            defaultValue={toDateInputValue(log.fechaFabricacionValvulaBypass)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaFabricacionValvulaRetornoVapores-${log.id}`}>
            Válvula de retorno de vapores
          </label>
          <input
            id={`fechaFabricacionValvulaRetornoVapores-${log.id}`}
            name="fechaFabricacionValvulaRetornoVapores"
            type="date"
            defaultValue={toDateInputValue(log.fechaFabricacionValvulaRetornoVapores)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaFabricacionValvulaServicio-${log.id}`}>
            Válvula de servicio de vapor
          </label>
          <input
            id={`fechaFabricacionValvulaServicio-${log.id}`}
            name="fechaFabricacionValvulaServicio"
            type="date"
            defaultValue={toDateInputValue(log.fechaFabricacionValvulaServicio)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaFabricacionValvulaMaximoLlenado-${log.id}`}>
            Válvula de máximo llenado 90%
          </label>
          <input
            id={`fechaFabricacionValvulaMaximoLlenado-${log.id}`}
            name="fechaFabricacionValvulaMaximoLlenado"
            type="date"
            defaultValue={toDateInputValue(log.fechaFabricacionValvulaMaximoLlenado)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaFabricacionValvulaAlivio-${log.id}`}>
            Válvula de seguridad
          </label>
          <input
            id={`fechaFabricacionValvulaAlivio-${log.id}`}
            name="fechaFabricacionValvulaAlivio"
            type="date"
            defaultValue={toDateInputValue(log.fechaFabricacionValvulaAlivio)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaFabricacionValvulaDescargaEmergencia-${log.id}`}>
            Válvula de descarga de emergencia
          </label>
          <input
            id={`fechaFabricacionValvulaDescargaEmergencia-${log.id}`}
            name="fechaFabricacionValvulaDescargaEmergencia"
            type="date"
            defaultValue={toDateInputValue(log.fechaFabricacionValvulaDescargaEmergencia)}
            className={inputClass}
          />
        </div>
      </div>
      <div className="rounded-md border border-dashed border-gray-300 p-2">
        <label className="flex items-center gap-2 text-xs font-medium text-ink" htmlFor={`tieneValvulaMaximoLlenado85-${log.id}`}>
          <input
            id={`tieneValvulaMaximoLlenado85-${log.id}`}
            name="tieneValvulaMaximoLlenado85"
            type="checkbox"
            checked={tieneValvula85}
            onChange={(event) => setTieneValvula85(event.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
          />
          ¿Esta unidad tiene válvula de máximo llenado al 85%?
        </label>
        {tieneValvula85 && (
          <div className="mt-2 max-w-xs">
            <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`fechaFabricacionValvulaMaximoLlenado85-${log.id}`}>
              Fecha de fabricación de la válvula de máximo llenado 85%
            </label>
            <input
              id={`fechaFabricacionValvulaMaximoLlenado85-${log.id}`}
              name="fechaFabricacionValvulaMaximoLlenado85"
              type="date"
              defaultValue={toDateInputValue(log.fechaFabricacionValvulaMaximoLlenado85)}
              className={inputClass}
            />
          </div>
        )}
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
              label="Válvula de no retroceso (check)"
              value={formatDate(log.fechaFabricacionValvulaNoRetroceso)}
            />
            <Field
              label="Válvula de retroceso (bypass)"
              value={formatDate(log.fechaFabricacionValvulaBypass)}
            />
            <Field
              label="Válvula de retorno de vapores"
              value={formatDate(log.fechaFabricacionValvulaRetornoVapores)}
            />
            <Field
              label="Válvula de servicio de vapor"
              value={formatDate(log.fechaFabricacionValvulaServicio)}
            />
            <Field
              label="Válvula de máximo llenado 90%"
              value={formatDate(log.fechaFabricacionValvulaMaximoLlenado)}
            />
            {log.tieneValvulaMaximoLlenado85 && (
              <Field
                label="Válvula de máximo llenado 85%"
                value={formatDate(log.fechaFabricacionValvulaMaximoLlenado85)}
              />
            )}
            <Field
              label="Válvula de seguridad"
              value={formatDate(log.fechaFabricacionValvulaAlivio)}
            />
            <Field
              label="Válvula de descarga de emergencia"
              value={formatDate(log.fechaFabricacionValvulaDescargaEmergencia)}
            />
          </dl>

          {isAdmin && <EditValveChangeLogForm log={log} />}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Documentos (PDF o imagen)
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
