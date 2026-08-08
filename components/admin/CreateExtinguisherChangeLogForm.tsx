"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createExtinguisherChangeLog } from "@/actions/extinguisher-actions";
import type { ActionState } from "@/actions/user-actions";
import { calidadExtintorLabels } from "@/lib/vehicle-enums";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Aceptar"}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function CreateExtinguisherChangeLogForm({ vehicleId }: { vehicleId: string }) {
  const action = createExtinguisherChangeLog.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <details className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Registrar cambio de extintor
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
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="ext-responsable">
              Responsable
            </label>
            <input id="ext-responsable" name="responsable" className={inputClass} />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="ext-fechaInstalacion"
            >
              Fecha de instalación
            </label>
            <input
              id="ext-fechaInstalacion"
              name="fechaInstalacion"
              type="date"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="ext-fechaVencimiento"
            >
              Fecha de vencimiento
            </label>
            <input
              id="ext-fechaVencimiento"
              name="fechaVencimiento"
              type="date"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="ext-calidad">
              Calidad
            </label>
            <select id="ext-calidad" name="calidad" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Selecciona...
              </option>
              {Object.entries(calidadExtintorLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="ext-files">
            Documentos (PDF o imagen, opcional)
          </label>
          <input
            id="ext-files"
            name="files"
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
          />
        </div>

        <p className="text-xs text-ink">
          Al aceptar, la ficha técnica actualizará automáticamente la fecha de instalación y de
          vencimiento del extintor. La calidad de este registro es solo un dato histórico de este
          cambio: la calidad vigente de la unidad se controla y se corrige directo en la ficha
          técnica.
        </p>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
