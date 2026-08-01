"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createMaintenanceLog } from "@/actions/maintenance-actions";
import type { ActionState } from "@/actions/user-actions";
import { maintenanceStatusLabels } from "@/lib/vehicle-enums";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Registrar mantenimiento"}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function CreateMaintenanceLogForm({ vehicleId }: { vehicleId: string }) {
  const action = createMaintenanceLog.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <details className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Registrar mantenimiento
      </summary>

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-tipoMantenimiento">
              Tipo de mantenimiento
            </label>
            <input id="mnt-tipoMantenimiento" name="tipoMantenimiento" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-tipoServicio">
              Tipo de servicio
            </label>
            <input id="mnt-tipoServicio" name="tipoServicio" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-fecha">
              Fecha
            </label>
            <input id="mnt-fecha" name="fecha" type="date" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-pieza">
              Pieza
            </label>
            <input id="mnt-pieza" name="pieza" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-cantidad">
              Cantidad
            </label>
            <input id="mnt-cantidad" name="cantidad" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-unidad">
              Unidad
            </label>
            <input id="mnt-unidad" name="unidad" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-estatus">
              Estatus del proceso
            </label>
            <select id="mnt-estatus" name="estatus" defaultValue="SIN_ATENCION" className={inputClass}>
              {Object.entries(maintenanceStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-nombreOperador">
              Nombre del operador
            </label>
            <input id="mnt-nombreOperador" name="nombreOperador" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-auxiliarTecnico">
              Auxiliar técnico
            </label>
            <input id="mnt-auxiliarTecnico" name="auxiliarTecnico" className={inputClass} />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="mnt-responsableTrabajoMecanico"
            >
              Responsable del trabajo mecánico
            </label>
            <input
              id="mnt-responsableTrabajoMecanico"
              name="responsableTrabajoMecanico"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-descripcion">
            Descripción
          </label>
          <textarea id="mnt-descripcion" name="descripcion" rows={2} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-observacion">
            Observación
          </label>
          <textarea id="mnt-observacion" name="observacion" rows={2} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-files">
            Documentos (PDF, opcional)
          </label>
          <input
            id="mnt-files"
            name="files"
            type="file"
            accept="application/pdf"
            multiple
            className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
          />
        </div>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
