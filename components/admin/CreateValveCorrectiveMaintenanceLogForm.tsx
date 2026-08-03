"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createValveCorrectiveMaintenanceLog } from "@/actions/valve-corrective-maintenance-actions";
import type { ActionState } from "@/actions/user-actions";
import { valvulaCorrectivaLabels } from "@/lib/valve-alerts";
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

export function CreateValveCorrectiveMaintenanceLogForm({ vehicleId }: { vehicleId: string }) {
  const action = createValveCorrectiveMaintenanceLog.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <details className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Registrar mantenimiento correctivo
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
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="valvcorr-valvula">
              Válvula afectada
            </label>
            <select id="valvcorr-valvula" name="valvula" required className={inputClass}>
              {Object.entries(valvulaCorrectivaLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="valvcorr-fecha">
              Fecha
            </label>
            <input id="valvcorr-fecha" name="fecha" type="date" required className={inputClass} />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="valvcorr-responsable"
            >
              Responsable
            </label>
            <input id="valvcorr-responsable" name="responsable" className={inputClass} />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="valvcorr-descripcion">
            Descripción de la reparación
          </label>
          <textarea
            id="valvcorr-descripcion"
            name="descripcion"
            required
            rows={3}
            className={inputClass}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="valvcorr-files">
            Documentos (PDF, opcional)
          </label>
          <input
            id="valvcorr-files"
            name="files"
            type="file"
            accept="application/pdf"
            multiple
            className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
          />
        </div>

        <p className="text-xs text-ink">
          Este registro es solo historial de reparaciones correctivas de válvulas; no afecta la
          fecha de cambio preventivo de la ficha técnica.
        </p>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
