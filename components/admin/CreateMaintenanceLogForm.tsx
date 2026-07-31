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
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="tipoMantenimiento">
              Tipo de mantenimiento
            </label>
            <input id="tipoMantenimiento" name="tipoMantenimiento" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="tipoServicio">
              Tipo de servicio
            </label>
            <input id="tipoServicio" name="tipoServicio" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="fecha">
              Fecha
            </label>
            <input id="fecha" name="fecha" type="date" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pieza">
              Pieza
            </label>
            <input id="pieza" name="pieza" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="cantidad">
              Cantidad
            </label>
            <input id="cantidad" name="cantidad" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="unidad">
              Unidad
            </label>
            <input id="unidad" name="unidad" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="estatus">
              Estatus del proceso
            </label>
            <select id="estatus" name="estatus" defaultValue="SIN_ATENCION" className={inputClass}>
              {Object.entries(maintenanceStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="nombreOperador">
              Nombre del operador
            </label>
            <input id="nombreOperador" name="nombreOperador" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="auxiliarTecnico">
              Auxiliar técnico
            </label>
            <input id="auxiliarTecnico" name="auxiliarTecnico" className={inputClass} />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="responsableTrabajoMecanico"
            >
              Responsable del trabajo mecánico
            </label>
            <input
              id="responsableTrabajoMecanico"
              name="responsableTrabajoMecanico"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="descripcion">
            Descripción
          </label>
          <textarea id="descripcion" name="descripcion" rows={2} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="observacion">
            Observación
          </label>
          <textarea id="observacion" name="observacion" rows={2} className={inputClass} />
        </div>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
