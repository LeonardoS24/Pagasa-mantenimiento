"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createUser, type ActionState } from "@/actions/user-actions";
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
      {pending ? "Creando..." : "Crear usuario"}
    </button>
  );
}

export function CreateUserForm() {
  const [state, formAction] = useFormState(createUser, initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Crear usuario
      </h2>

      <div className="grid gap-3 sm:grid-cols-3">
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
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
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
            <option value="USUARIO">Usuario</option>
            <option value="ADMIN">Administrador</option>
          </select>
        </div>
      </div>

      <FormMessage state={state} />

      <SubmitButton />
    </form>
  );
}
