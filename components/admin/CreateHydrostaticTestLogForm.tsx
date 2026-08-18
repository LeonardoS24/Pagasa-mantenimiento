"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createHydrostaticTestLog } from "@/actions/hydrostatic-test-actions";
import type { ActionState } from "@/actions/user-actions";
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

export function CreateHydrostaticTestLogForm({
  vehicleId,
  stationTankTechnicalSheetId,
  ultimaPruebaHidrostatica,
}: {
  vehicleId: string;
  stationTankTechnicalSheetId?: string | null;
  ultimaPruebaHidrostatica: string;
}) {
  const action = createHydrostaticTestLog.bind(null, vehicleId, stationTankTechnicalSheetId ?? null);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <details className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Registrar prueba hidrostática
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
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="hy-compania">
              Compañía
            </label>
            <input id="hy-compania" name="compania" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="hy-numeroPrueba">
              Número de prueba
            </label>
            <input id="hy-numeroPrueba" name="numeroPrueba" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="hy-responsable">
              Responsable
            </label>
            <input id="hy-responsable" name="responsable" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="hy-fechaUltimaPrueba">
              Última fecha de prueba hidrostática
            </label>
            <input
              id="hy-fechaUltimaPrueba"
              name="fechaUltimaPrueba"
              type="date"
              defaultValue={ultimaPruebaHidrostatica}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="hy-fechaRealizacion">
              Fecha de realización de la nueva prueba
            </label>
            <input
              id="hy-fechaRealizacion"
              name="fechaRealizacion"
              type="date"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="hy-files">
            Documentos (PDF o imagen, opcional)
          </label>
          <input
            id="hy-files"
            name="files"
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
          />
        </div>

        <p className="text-xs text-ink">
          Al aceptar, la ficha técnica actualizará automáticamente su “última prueba hidrostática”
          y la fecha próxima se recorrerá 5 años a partir de esta fecha (la primera prueba, desde
          la fabricación del tanque, vence a los 10 años; de ahí en adelante cada 5).
        </p>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
