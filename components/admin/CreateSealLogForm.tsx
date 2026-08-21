"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createSealLog } from "@/actions/seal-actions";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Registrar sello"}
    </button>
  );
}

// Formulario deliberadamente corto (solo número y fecha): los sellos se
// cambian día con día, así que capturarlos tiene que ser rápido.
export function CreateSealLogForm({ vehicleId }: { vehicleId: string }) {
  const action = createSealLog.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="sello-numero">
          Número de sello
        </label>
        <input id="sello-numero" name="numeroSello" required className={inputClass} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="sello-fecha">
          Fecha de instalación
        </label>
        <input id="sello-fecha" name="fechaInstalacion" type="date" required className={inputClass} />
      </div>
      <SubmitButton />
      <FormMessage state={state} />
    </form>
  );
}
