"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createHoseChangeLog } from "@/actions/hose-actions";
import type { ActionState } from "@/actions/user-actions";
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
      {pending ? "Guardando..." : "Aceptar"}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function CreateHoseChangeLogForm({ vehicleId }: { vehicleId: string }) {
  const action = createHoseChangeLog.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <details className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Registrar cambio de mangueras
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
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="hose-responsable">
              Responsable
            </label>
            <input id="hose-responsable" name="responsable" className={inputClass} />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="hose-fechaInstalacion"
            >
              Fecha de instalación
            </label>
            <input
              id="hose-fechaInstalacion"
              name="fechaInstalacion"
              type="date"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="hose-fechaFabricacionManguera"
            >
              Fecha de fabricación de la manguera
            </label>
            <input
              id="hose-fechaFabricacionManguera"
              name="fechaFabricacionManguera"
              type="date"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="hose-files">
            Documentos (PDF, opcional)
          </label>
          <input
            id="hose-files"
            name="files"
            type="file"
            accept="application/pdf"
            multiple
            className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
          />
        </div>

        <p className="text-xs text-ink">
          Al aceptar, la ficha técnica actualizará automáticamente la fecha de fabricación y la
          fecha de instalación. El aviso de cambio vence a los 2 años de fabricación.
        </p>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
