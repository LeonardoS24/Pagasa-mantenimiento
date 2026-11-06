"use client";

import { useFormState, useFormStatus } from "react-dom";
import { verificarCodigoAction, type LoginState } from "@/actions/auth-actions";

const inicial: LoginState = {};

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Verificando..." : "Verificar"}
    </button>
  );
}

export function VerificarCodigoForm() {
  const [state, formAction] = useFormState(verificarCodigoAction, inicial);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="codigo" className="mb-1 block text-sm font-medium text-ink">
          Código de la aplicación
        </label>
        <input
          id="codigo"
          name="codigo"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          placeholder="123456"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-center text-lg tracking-widest text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <p className="mt-1 text-xs text-gray-600">
          Abre la aplicación de verificación (Google Authenticator, Microsoft Authenticator...) y escribe el código de 6 dígitos. Si perdiste el teléfono, escribe uno de tus
          códigos de recuperación (como ABCDE-FGHJK).
        </p>
      </div>
      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <Enviar />
    </form>
  );
}
