"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { crearLoteDocumentos } from "@/actions/lote-documentos-actions";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "@/components/admin/FormMessage";
import { TIPOS_LOTE, tipoLoteLabel } from "@/lib/lote-documentos";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

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
  const [cuantos, setCuantos] = useState(0);
  const varios = cuantos > 1;

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="lote-archivo">
          PDF escaneado (uno con varios documentos juntos, o varios PDF a la vez; hasta 20 MB en total)
        </label>
        <input
          id="lote-archivo"
          name="archivo"
          type="file"
          accept="application/pdf"
          multiple
          required
          onChange={(e) => setCuantos(e.target.files?.length ?? 0)}
          className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
        />
      </div>
      {varios && (
        <div className="max-w-sm">
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="lote-tipo">
            Tipo de documento (si todos son del mismo tipo)
          </label>
          <select id="lote-tipo" name="tipo" defaultValue="" className={inputClass}>
            <option value="">— Lo elijo en cada uno —</option>
            {TIPOS_LOTE.map((t) => (
              <option key={t} value={t}>
                {tipoLoteLabel[t]}
              </option>
            ))}
          </select>
        </div>
      )}
      <p className="text-xs text-ink">
        {varios
          ? `Se subirán ${cuantos} archivos: cada uno queda como un documento, y la unidad se elige sola si su número económico viene en el nombre del archivo (p. ej. "Hermeticidad PH-10.pdf"). Revisa y completa cada uno antes de guardarlo.`
          : conIA
            ? "La IA separa el escaneo en documentos, reconoce la unidad y llena los recuadros. Nada se guarda en las bitácoras hasta que lo revises y confirmes cada documento."
            : "Después indicas qué páginas son de cada documento y de qué unidad. Nada se guarda en las bitácoras hasta que lo revises y confirmes cada uno."}
      </p>
      <FormMessage state={state} />
      <SubmitButton conIA={conIA && !varios} />
    </form>
  );
}
