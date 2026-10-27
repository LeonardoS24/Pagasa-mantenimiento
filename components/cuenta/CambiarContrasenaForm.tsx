"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { cambiarMiContrasena, type CambioContrasenaState } from "@/actions/cuenta-actions";
import { PasswordInput } from "@/components/PasswordInput";
import { REGLAS_CONTRASENA, problemaDeContrasena } from "@/lib/politica-contrasena";

const inicial: CambioContrasenaState = {};
const campo =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-primary px-4 py-2 font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Guardar contraseña"}
    </button>
  );
}

export function CambiarContrasenaForm({ username, desde }: { username: string; desde: string | null }) {
  const [state, formAction] = useFormState(cambiarMiContrasena, inicial);
  const [nueva, setNueva] = useState("");
  const aviso = nueva ? problemaDeContrasena(nueva, username) : null;

  return (
    <form action={formAction} className="space-y-4">
      {desde && <input type="hidden" name="from" value={desde} />}
      {/* Para que el gestor de contraseñas del navegador sepa de qué cuenta es. */}
      <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
      <div>
        <label htmlFor="actual" className="mb-1 block text-sm font-medium text-ink">
          Contraseña actual
        </label>
        <PasswordInput id="actual" name="actual" autoComplete="current-password" required className={campo} />
      </div>
      <div>
        <label htmlFor="nueva" className="mb-1 block text-sm font-medium text-ink">
          Contraseña nueva
        </label>
        <div onInput={(e) => setNueva((e.target as HTMLInputElement).value)}>
          <PasswordInput id="nueva" name="nueva" autoComplete="new-password" required className={campo} />
        </div>
        {nueva && (
          <p className={`mt-1 text-xs ${aviso ? "text-orange-700" : "text-green-700"}`}>{aviso ?? "Cumple con todo."}</p>
        )}
      </div>
      <div>
        <label htmlFor="confirmar" className="mb-1 block text-sm font-medium text-ink">
          Repite la contraseña nueva
        </label>
        <PasswordInput id="confirmar" name="confirmar" autoComplete="new-password" required className={campo} />
      </div>
      <ul className="list-disc space-y-0.5 pl-5 text-xs text-gray-600">
        {REGLAS_CONTRASENA.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      <Enviar />
    </form>
  );
}
