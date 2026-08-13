"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import type { MaintenanceLog, Document, InventoryItem } from "@prisma/client";
import { updateMaintenanceLog, updateMaintenanceLogFull, deleteMaintenanceLog } from "@/actions/maintenance-actions";
import type { ActionState } from "@/actions/user-actions";
import {
  maintenanceStatusLabels,
  maintenanceTypeOptions,
  maintenanceStatusStyles,
  calidadMantenimientoOptions,
  calidadMantenimientoLabels,
  type MaintenanceStatus,
} from "@/lib/vehicle-enums";
import { accionPiezaOptions } from "@/lib/piece-catalog";
import { formatCantidad } from "@/lib/inventory-enums";
import { formatDate, toDateInputValue } from "@/lib/dates";
import { parseChecklistPreventivo } from "@/lib/preventive-checklist";
import { DocumentList } from "./DocumentList";
import { MaintenancePhotos } from "./MaintenancePhotos";
import { UploadMaintenanceLogDocumentForm } from "@/components/admin/UploadMaintenanceLogDocumentForm";
import { ConfirmDeleteRecordWithPassword } from "@/components/admin/ConfirmDeleteRecordWithPassword";

const initialState: ActionState = {};

type MaintenanceLogWithDocuments = MaintenanceLog & {
  documents: Document[];
  piezasUtilizadas: InventoryItem[];
};

const inputClass =
  "w-full rounded-md border border-gray-300 px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

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
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function EditStatusForm({ log }: { log: MaintenanceLog }) {
  const action = updateMaintenanceLog.bind(null, log.id);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
      {/* Descripción: solo ADMIN la edita (ver EditMaintenanceLogFullForm); un
          USUARIO solo puede verla, ya mostrada de solo lectura arriba en el
          detalle expandido. */}
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

// Edición completa, solo ADMIN: cubre todos los campos capturables (el
// checklist de mantenimiento preventivo no se re-edita aquí, ver
// actions/maintenance-actions.ts). Se suma a EditStatusForm (que ahora
// también ve el admin) para los casos donde hace falta corregir algo más que
// el estatus. Empieza bloqueada — hay que apretar "Editar registro completo"
// — para no cambiar o borrar algo sin querer con solo dar clic.
function EditMaintenanceLogFullForm({ log }: { log: MaintenanceLog }) {
  const action = updateMaintenanceLogFull.bind(null, log.id);
  const [state, formAction] = useFormState(action, initialState);
  const [locked, setLocked] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCancel() {
    formRef.current?.reset();
    setLocked(true);
  }

  if (locked) {
    return (
      <button
        type="button"
        onClick={() => setLocked(false)}
        className="mt-3 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-ink hover:bg-gray-50"
      >
        Editar registro completo
      </button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="mt-3 space-y-2 rounded-md bg-gray-50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-ink">Editando el registro completo</p>
        <button type="button" onClick={handleCancel} className="text-xs text-ink hover:underline">
          Cancelar
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`tipoMantenimiento-${log.id}`}>
            Tipo de mantenimiento
          </label>
          <select
            id={`tipoMantenimiento-${log.id}`}
            name="tipoMantenimiento"
            defaultValue={log.tipoMantenimiento}
            className={inputClass}
          >
            {maintenanceTypeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`tipoServicio-${log.id}`}>
            Tipo de servicio
          </label>
          <input
            id={`tipoServicio-${log.id}`}
            name="tipoServicio"
            defaultValue={log.tipoServicio}
            className={inputClass}
          />
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
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`kilometraje-${log.id}`}>
            Kilometraje
          </label>
          <input
            id={`kilometraje-${log.id}`}
            name="kilometraje"
            type="number"
            min={0}
            required
            defaultValue={log.kilometraje ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`calidad-${log.id}`}>
            Calidad general de la unidad
          </label>
          <select
            id={`calidad-${log.id}`}
            name="calidad"
            required
            defaultValue={log.calidad ?? ""}
            className={inputClass}
          >
            <option value="" disabled>
              Selecciona...
            </option>
            {calidadMantenimientoOptions.map((opt) => (
              <option key={opt} value={opt}>
                {calidadMantenimientoLabels[opt]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`categoriaPieza-${log.id}`}>
            Categoría de la pieza
          </label>
          <input
            id={`categoriaPieza-${log.id}`}
            name="categoriaPieza"
            defaultValue={log.categoriaPieza ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`pieza-${log.id}`}>
            Pieza
          </label>
          <input id={`pieza-${log.id}`} name="pieza" defaultValue={log.pieza ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`accionPieza-${log.id}`}>
            Acción realizada en la pieza
          </label>
          <select
            id={`accionPieza-${log.id}`}
            name="accionPieza"
            defaultValue={log.accionPieza ?? ""}
            className={inputClass}
          >
            <option value="">Sin especificar</option>
            {accionPiezaOptions.map((accion) => (
              <option key={accion} value={accion}>
                {accion}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`cantidad-${log.id}`}>
            Cantidad
          </label>
          <input id={`cantidad-${log.id}`} name="cantidad" defaultValue={log.cantidad ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`unidad-${log.id}`}>
            Unidad
          </label>
          <input id={`unidad-${log.id}`} name="unidad" defaultValue={log.unidad ?? ""} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`estatus-${log.id}`}>
            Estatus del proceso
          </label>
          <select id={`estatus-${log.id}`} name="estatus" defaultValue={log.estatus} className={inputClass}>
            {Object.entries(maintenanceStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`nombreOperador-${log.id}`}>
            Nombre del operador
          </label>
          <input
            id={`nombreOperador-${log.id}`}
            name="nombreOperador"
            defaultValue={log.nombreOperador ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`auxiliarTecnico-${log.id}`}>
            Auxiliar técnico
          </label>
          <input
            id={`auxiliarTecnico-${log.id}`}
            name="auxiliarTecnico"
            defaultValue={log.auxiliarTecnico ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label
            className="mb-1 block text-xs font-medium text-ink"
            htmlFor={`responsableTrabajoMecanico-${log.id}`}
          >
            Responsable del trabajo mecánico
          </label>
          <input
            id={`responsableTrabajoMecanico-${log.id}`}
            name="responsableTrabajoMecanico"
            defaultValue={log.responsableTrabajoMecanico ?? ""}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`descripcion-full-${log.id}`}>
          Descripción
        </label>
        <textarea
          id={`descripcion-full-${log.id}`}
          name="descripcion"
          rows={2}
          defaultValue={log.descripcion ?? ""}
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
      {log.checklistPreventivo && (
        <p className="text-xs text-gray-500">
          El checklist de mantenimiento preventivo no se edita aquí; queda tal como se capturó.
        </p>
      )}
      <SubmitButton />
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
  // Desglose de PieceMaintenanceChart (ver components/city/PieceMaintenanceChart.tsx):
  // sus links a esta unidad llevan ?mantenimiento=<id> para llegar directo a
  // este registro ya expandido y resaltado, en vez de tener que buscarlo a
  // mano en la lista.
  const searchParams = useSearchParams();
  const isTarget = searchParams.get("mantenimiento") === log.id;
  const [expanded, setExpanded] = useState(isTarget);
  const checklist = parseChecklistPreventivo(log.checklistPreventivo);
  const rowRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (isTarget) rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Solo al montar: no se vuelve a disparar si el usuario colapsa el detalle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <li
      ref={rowRef}
      className={`px-4 py-3 ${isTarget ? "bg-accent/5 ring-1 ring-inset ring-accent/40" : ""}`}
    >
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
            <Field
              label="Kilometraje"
              value={log.kilometraje != null ? `${log.kilometraje.toLocaleString("es-MX")} km` : null}
            />
            <Field
              label="Calidad general reportada"
              value={log.calidad ? calidadMantenimientoLabels[log.calidad as keyof typeof calidadMantenimientoLabels] : null}
            />
            <Field label="Categoría de la pieza" value={log.categoriaPieza} />
            <Field label="Pieza" value={log.pieza} />
            <Field label="Acción realizada en la pieza" value={log.accionPieza} />
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

          {log.piezasUtilizadas.length > 0 && (
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">Pieza de inventario</dt>
              <dd className="mt-1 flex flex-wrap gap-1.5">
                {log.piezasUtilizadas.map((item) => (
                  <span
                    key={item.id}
                    className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                  >
                    {item.nombre} · {formatCantidad(item.cantidad, item.unidad)}
                  </span>
                ))}
              </dd>
            </div>
          )}

          <Field label="Descripción" value={log.descripcion} />
          <Field label="Observación" value={log.observacion} />

          {checklist && checklist.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                Checklist de mantenimiento preventivo
              </p>
              <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {checklist.map((entry) => (
                  <div key={entry.item} className="text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-ink">{entry.item}</dt>
                      <dd
                        className={
                          entry.estado === "Buen estado" ? "text-gray-500" : "font-medium text-accent"
                        }
                      >
                        {entry.estado}
                        {entry.cantidad && ` (${entry.cantidad})`}
                      </dd>
                    </div>
                    {entry.descripcion && <dd className="mt-0.5 text-gray-500">{entry.descripcion}</dd>}
                  </div>
                ))}
              </dl>
            </div>
          )}

          {canEdit && <EditStatusForm log={log} />}
          {isAdmin && <EditMaintenanceLogFullForm log={log} />}

          <MaintenancePhotos documents={log.documents} isAdmin={isAdmin} />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
              Documentos (PDF o imagen)
            </p>
            <div className="space-y-2">
              {canEdit && <UploadMaintenanceLogDocumentForm maintenanceLogId={log.id} />}
              <DocumentList
                documents={log.documents.filter((d) => d.kind === "ADJUNTO")}
                isAdmin={isAdmin}
              />
            </div>
          </div>

          {isAdmin && (
            <ConfirmDeleteRecordWithPassword
              mensaje={`¿Eliminar este mantenimiento (${log.tipoMantenimiento} — ${log.tipoServicio})? También se eliminarán sus documentos.`}
              action={deleteMaintenanceLog.bind(null, log.id)}
              className="text-sm text-accent hover:underline"
            >
              Eliminar mantenimiento
            </ConfirmDeleteRecordWithPassword>
          )}
        </div>
      )}
    </li>
  );
}
