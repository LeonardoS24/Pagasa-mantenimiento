"use client";

import { useFormState, useFormStatus } from "react-dom";
import { reintentarLecturaLote } from "@/actions/lote-documentos-actions";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "@/components/admin/FormMessage";

const initialState: ActionState = {};

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:opacity-60"
    >
      {pending ? "Enviando..." : "Volver a leer con IA"}
    </button>
  );
}

export function ReintentarLecturaButton({ loteId }: { loteId: string }) {
  const [state, formAction] = useFormState(reintentarLecturaLote.bind(null, loteId), initialState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <Boton />
      <FormMessage state={state} />
    </form>
  );
}
