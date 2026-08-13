"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/user-actions";

const initialState: ActionState = {};

function BotonConfirmar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-60"
    >
      {pending ? "Eliminando..." : "Confirmar y eliminar"}
    </button>
  );
}

// Igual que ConfirmDeleteWithPassword pero para un registro suelto (una
// bitácora, un documento, una orden, un artículo de inventario, un usuario):
// no hay que calcular un impacto en cascada porque no arrastra nada más, pero
// de igual manera se exige la contraseña de administrador antes de borrar.
export function ConfirmDeleteRecordWithPassword({
  mensaje,
  action,
  className,
  children,
  extraContent,
}: {
  mensaje: string;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  className?: string;
  children: React.ReactNode;
  // Contenido adicional (p. ej. un campo de texto) que se muestra junto con
  // la contraseña, una vez que ya se confirmó la intención de borrar.
  extraContent?: React.ReactNode;
}) {
  const [state, formAction] = useFormState(action, initialState);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (state.success) {
      setAbierto(false);
    }
  }, [state.success]);

  if (!abierto) {
    return (
      <button type="button" className={className} onClick={() => setAbierto(true)}>
        {children}
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-2 text-left">
      <p className="text-xs text-ink">{mensaje}</p>
      {extraContent}
      <label className="flex flex-col gap-1 text-xs text-ink">
        Escribe tu contraseña para confirmar
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </label>
      <div className="flex gap-2">
        <BotonConfirmar />
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="shrink-0 rounded-md border border-gray-300 px-3 py-1 text-xs text-ink hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
