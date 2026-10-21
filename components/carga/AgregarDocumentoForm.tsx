"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { agregarDocumentoALote } from "@/actions/lote-documentos-actions";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "@/components/admin/FormMessage";
import { TIPOS_LOTE, tipoLoteLabel } from "@/lib/lote-documentos";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/5 disabled:opacity-60"
    >
      {pending ? "Agregando..." : "Agregar"}
    </button>
  );
}

export function AgregarDocumentoForm({
  loteId,
  paginasTotal,
  abierto,
}: {
  loteId: string;
  paginasTotal: number;
  abierto: boolean;
}) {
  const [state, formAction] = useFormState(agregarDocumentoALote.bind(null, loteId), initialState);
  const formRef = useRef<HTMLFormElement>(null);
  // Estado propio y no la prop directa: al dividir a mano se agregan varios
  // documentos seguidos, y sin esto el recuadro se cerraba después del
  // primero (la página se vuelve a pintar con abierto=false).
  const [abiertoAhora, setAbiertoAhora] = useState(abierto);

  return (
    <details
      open={abiertoAhora}
      onToggle={(e) => setAbiertoAhora(e.currentTarget.open)}
      className="rounded-lg border border-dashed border-gray-300 bg-white p-4"
    >
      <summary className="cursor-pointer text-sm font-semibold text-primary">Agregar un documento a mano</summary>
      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="nuevo-tipo">
              Tipo de documento
            </label>
            <select id="nuevo-tipo" name="tipo" defaultValue="" required className={inputClass}>
              <option value="" disabled>
                — Elegir —
              </option>
              {TIPOS_LOTE.map((t) => (
                <option key={t} value={t}>
                  {tipoLoteLabel[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="nuevo-desde">
              Desde la página
            </label>
            <input id="nuevo-desde" name="paginaInicio" type="number" min={1} max={paginasTotal} required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="nuevo-hasta">
              Hasta la página
            </label>
            <input id="nuevo-hasta" name="paginaFin" type="number" min={1} max={paginasTotal} required className={inputClass} />
          </div>
        </div>
        <FormMessage state={state} />
        <Boton />
      </form>
    </details>
  );
}
