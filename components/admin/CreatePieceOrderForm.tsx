"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createPieceOrder } from "@/actions/piece-order-actions";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Registrar orden"}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function CreatePieceOrderForm({ sectionId }: { sectionId: string }) {
  const action = createPieceOrder.bind(null, sectionId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <details className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Registrar orden de pieza
      </summary>

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
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pieza">
              Pieza
            </label>
            <input id="pieza" name="pieza" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="cantidad">
              Cantidad
            </label>
            <input id="cantidad" name="cantidad" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="fechaOrden">
              Fecha de la orden
            </label>
            <input id="fechaOrden" name="fechaOrden" type="date" required className={inputClass} />
          </div>
        </div>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
