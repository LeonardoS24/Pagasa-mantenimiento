"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createUser, type ActionState } from "@/actions/user-actions";
import { roleLabels } from "@/lib/roles";
import { PasswordInput } from "@/components/PasswordInput";
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
      {pending ? "Creando..." : "Crear usuario"}
    </button>
  );
}

export function CreateUserForm() {
  const [state, formAction] = useFormState(createUser, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase text-primary-bright">
        Crear usuario
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="username">
            Usuario
          </label>
          <input
            id="username"
            name="username"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="puesto">
            Puesto
          </label>
          <input
            id="puesto"
            name="puesto"
            required
            placeholder="Ej. Jefe de mantenimiento"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="password">
            Contraseña
          </label>
          <PasswordInput
            id="password"
            name="password"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="role">
            Rol
          </label>
          <select
            id="role"
            name="role"
            defaultValue="USUARIO"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          >
            <option value="USUARIO">{roleLabels.USUARIO}</option>
            <option value="LECTOR">{roleLabels.LECTOR}</option>
            <option value="ADMIN">{roleLabels.ADMIN}</option>
          </select>
        </div>
      </div>

      <FormMessage state={state} />

      <SubmitButton />
    </form>
  );
}
