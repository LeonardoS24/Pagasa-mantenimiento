"use client";

import { useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addChecklistItem, deleteChecklistItem } from "@/actions/checklist-actions";
import type { ActionState } from "@/actions/user-actions";
import {
  CHECKLIST_LISTAS,
  checklistListaLabels,
  type ChecklistLista,
} from "@/lib/checklist-runtime";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export type ChecklistExtra = { id: string; lista: ChecklistLista; nombre: string; soloFugas: boolean };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Agregando..." : "Agregar ítem"}
    </button>
  );
}

function BotonQuitar({ item }: { item: ChecklistExtra }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`¿Quitar "${item.nombre}" del checklist?`)) return;
          startTransition(async () => {
            const result = await deleteChecklistItem(item.id, {}, new FormData());
            setError(result.error ?? null);
          });
        }}
        className="text-xs text-red-600 hover:underline disabled:opacity-60"
      >
        Quitar
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </>
  );
}

// Checklist de mantenimiento preventivo: la lista base vive en el código
// (lib/preventive-checklist.ts) y aquí se le agregan ítems con el tiempo.
// Lo agregado aparece al capturar un mantenimiento de tipo "Preventivo".
export function ChecklistPanel({
  items,
  extras,
}: {
  items: Record<ChecklistLista, string[]>;
  extras: ChecklistExtra[];
}) {
  const [state, formAction] = useFormState(addChecklistItem, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [lista, setLista] = useState<ChecklistLista>("GENERAL");
  const [verLista, setVerLista] = useState<ChecklistLista>("GENERAL");

  const extrasPorNombre = new Map(extras.filter((e) => e.lista === verLista).map((e) => [e.nombre, e]));

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">
          Agregar ítem al checklist preventivo
        </h2>
        <p className="mb-4 mt-1 text-xs text-gray-500">
          Aparecerá al capturar un mantenimiento de tipo &quot;Preventivo&quot;, en todas las ciudades.
        </p>

        <form
          ref={formRef}
          action={async (formData) => {
            await formAction(formData);
            formRef.current?.reset();
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="cl-lista">
                Checklist
              </label>
              <select
                id="cl-lista"
                name="lista"
                value={lista}
                onChange={(e) => setLista(e.target.value as ChecklistLista)}
                className={inputClass}
              >
                {CHECKLIST_LISTAS.map((l) => (
                  <option key={l} value={l}>
                    {checklistListaLabels[l]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="cl-nombre">
                Ítem a revisar
              </label>
              <input
                id="cl-nombre"
                name="nombre"
                required
                placeholder="Ej. Filtro secador"
                className={inputClass}
              />
            </div>

            {lista === "CARBURACION" && (
              <div className="flex items-end">
                <label className="flex items-center gap-2 pb-2 text-sm text-ink">
                  <input type="checkbox" name="soloFugas" className="h-4 w-4" />
                  Solo se revisa por fugas
                </label>
              </div>
            )}
          </div>

          <FormMessage state={state} />
          <SubmitButton />
        </form>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase text-primary-bright">Checklist actual</h2>
            <p className="mt-1 text-xs text-gray-500">
              Los ítems agregados desde aquí se pueden quitar; los que vienen de fábrica no.
            </p>
          </div>
          <select
            value={verLista}
            onChange={(e) => setVerLista(e.target.value as ChecklistLista)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-ink"
          >
            {CHECKLIST_LISTAS.map((l) => (
              <option key={l} value={l}>
                {checklistListaLabels[l]}
              </option>
            ))}
          </select>
        </div>

        <ul className="flex flex-wrap gap-2">
          {(items[verLista] ?? []).map((item) => {
            const extra = extrasPorNombre.get(item);
            return (
              <li
                key={item}
                className={`rounded-full px-3 py-1 text-xs ${
                  extra ? "bg-accent-light/20 text-accent" : "bg-gray-100 text-ink"
                }`}
              >
                {item}
                {extra?.soloFugas && <span className="text-gray-500"> (solo fugas)</span>}
                {extra && (
                  <>
                    {" · "}
                    <BotonQuitar item={extra} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
