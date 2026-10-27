"use client";

import { useFormState, useFormStatus } from "react-dom";
import { changeUserPassword, type ActionState } from "@/actions/user-actions";
import { PasswordInput } from "@/components/PasswordInput";
import { LARGO_MINIMO } from "@/lib/politica-contrasena";
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
      {pending ? "Guardando..." : "Cambiar contraseña"}
    </button>
  );
}

export function ChangePasswordForm({ userId }: { userId: string }) {
  const action = changeUserPassword.bind(null, userId);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="password">
          Nueva contraseña
        </label>
        <PasswordInput
          id="password"
          name="password"
          required
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <p className="mt-1 text-xs text-gray-500">
          Mínimo {LARGO_MINIMO} caracteres con letras y números. Al entrar, la persona tendrá que poner una suya; también se
          cierran sus sesiones abiertas y se le quita el bloqueo por intentos. (La tuya cámbiala en «Mi contraseña».)
        </p>
      </div>

      <FormMessage state={state} />

      <SubmitButton />
    </form>
  );
}
