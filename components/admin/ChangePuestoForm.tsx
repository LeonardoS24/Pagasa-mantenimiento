"use client";

import { useFormState, useFormStatus } from "react-dom";
import { changeUserPuesto, type ActionState } from "@/actions/user-actions";
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
      {pending ? "Guardando..." : "Guardar puesto"}
    </button>
  );
}

export function ChangePuestoForm({ userId, puesto }: { userId: string; puesto: string | null }) {
  const action = changeUserPuesto.bind(null, userId);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="puesto">
          Puesto
        </label>
        <input
          id="puesto"
          name="puesto"
          required
          defaultValue={puesto ?? ""}
          placeholder="Ej. Jefe de mantenimiento"
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>

      <FormMessage state={state} />

      <SubmitButton />
    </form>
  );
}
