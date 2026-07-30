"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createCity } from "@/actions/city-actions";
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
      {pending ? "Creando..." : "Crear ciudad"}
    </button>
  );
}

export function CreateCityForm() {
  const [state, formAction] = useFormState(createCity, initialState);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-gray-200 bg-white p-5"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Agregar ciudad
      </h2>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="name">
            Nombre de la ciudad
          </label>
          <input
            id="name"
            name="name"
            required
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <SubmitButton />
      </div>

      <FormMessage state={state} />
    </form>
  );
}
