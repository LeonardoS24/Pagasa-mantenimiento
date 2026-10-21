"use client";

import { useFormState, useFormStatus } from "react-dom";
import { crearLoteDocumentos } from "@/actions/lote-documentos-actions";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "@/components/admin/FormMessage";

const initialState: ActionState = {};

function SubmitButton({ conIA }: { conIA: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Subiendo..." : conIA ? "Subir y leer" : "Subir"}
    </button>
  );
}

export function SubirLoteForm({ citySlug, conIA }: { citySlug: string; conIA: boolean }) {
  const [state, formAction] = useFormState(crearLoteDocumentos.bind(null, citySlug), initialState);

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="lote-archivo">
          PDF escaneado (varios documentos juntos, hasta 20 MB)
        </label>
        <input
          id="lote-archivo"
          name="archivo"
          type="file"
          accept="application/pdf"
          required
          className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
        />
      </div>
      <p className="text-xs text-ink">
        {conIA
          ? "La IA separa el escaneo en documentos, reconoce la unidad y llena los recuadros. Nada se guarda en las bitácoras hasta que lo revises y confirmes cada documento."
          : "La lectura automática no está configurada en el servidor (falta ANTHROPIC_API_KEY): podrás dividir el escaneo a mano, indicando las páginas de cada documento."}
      </p>
      <FormMessage state={state} />
      <SubmitButton conIA={conIA} />
    </form>
  );
}
