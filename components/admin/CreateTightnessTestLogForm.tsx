"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createTightnessTestLog } from "@/actions/tightness-test-actions";
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

export function CreateTightnessTestLogForm({
  vehicleId,
  ultimaPruebaHermeticidad,
}: {
  vehicleId: string;
  ultimaPruebaHermeticidad: string;
}) {
  const action = createTightnessTestLog.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <details className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Registrar prueba de hermeticidad
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
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="th-compania">
              Compañía
            </label>
            <input id="th-compania" name="compania" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="th-numeroPrueba">
              Número de prueba
            </label>
            <input id="th-numeroPrueba" name="numeroPrueba" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="th-responsable">
              Responsable
            </label>
            <input id="th-responsable" name="responsable" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="th-fechaUltimaPrueba">
              Última fecha de prueba de hermeticidad
            </label>
            <input
              id="th-fechaUltimaPrueba"
              name="fechaUltimaPrueba"
              type="date"
              defaultValue={ultimaPruebaHermeticidad}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="th-fechaRealizacion">
              Fecha de realización de la nueva prueba
            </label>
            <input
              id="th-fechaRealizacion"
              name="fechaRealizacion"
              type="date"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="th-fechaProximaPrueba">
              Fecha de la próxima prueba
            </label>
            <input
              id="th-fechaProximaPrueba"
              name="fechaProximaPrueba"
              type="date"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="th-files">
            Documentos (PDF o imagen, opcional)
          </label>
          <input
            id="th-files"
            name="files"
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
          />
        </div>

        <p className="text-xs text-ink">
          Al aceptar, la ficha técnica actualizará automáticamente su “última prueba de
          hermeticidad” con la fecha de realización, y su “próxima” (la alerta) con la fecha de
          la próxima prueba.
        </p>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
