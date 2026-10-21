"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { eliminarLoteDocumentos } from "@/actions/lote-documentos-actions";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "@/components/admin/FormMessage";

const initialState: ActionState = {};

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60"
    >
      {pending ? "Eliminando..." : "Confirmar y eliminar"}
    </button>
  );
}

// Eliminar el lote completo (ver eliminarLoteDocumentos): solo se ofrece
// cuando nada de él se guardó en las bitácoras, y pide la contraseña.
export function EliminarLoteForm({ loteId }: { loteId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [state, formAction] = useFormState(eliminarLoteDocumentos.bind(null, loteId), initialState);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
      >
        Eliminar lote
      </button>
    );
  }
  return (
    <form action={formAction} className="w-full space-y-2 rounded-md border border-red-200 bg-red-50 p-3 sm:w-auto">
      <p className="text-sm text-red-800">
        Se borra el escaneo y la lista de documentos. No se toca ninguna bitácora (no hay nada guardado de este lote).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Tu contraseña"
          aria-label="Tu contraseña"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <Boton />
        <button type="button" onClick={() => setAbierto(false)} className="text-sm text-gray-600 hover:underline">
          Cancelar
        </button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
