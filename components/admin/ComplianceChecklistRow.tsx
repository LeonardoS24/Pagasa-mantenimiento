"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ComplianceChecklistItem } from "@prisma/client";
import { updateComplianceChecklistItem } from "@/actions/compliance-checklist-actions";
import type { ActionState } from "@/actions/user-actions";
import type { ComplianceItemDef } from "@/lib/compliance-checklist";
import { toDateInputValue } from "@/lib/dates";

const initialState: ActionState = {};

function GuardarButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "..." : "Guardar"}
    </button>
  );
}

// Solo dice si se tiene o no cada documento (con fecha y observación libres):
// no se sube ningún archivo aquí, eso vive en Documentación o en Manuales,
// según el documento.
export function ComplianceChecklistRow({
  vehicleId,
  item,
  fila,
  isEditor,
}: {
  vehicleId: string;
  item: ComplianceItemDef;
  fila: ComplianceChecklistItem | null;
  isEditor: boolean;
}) {
  const updateAction = updateComplianceChecklistItem.bind(null, vehicleId, item.clave);
  const [state, formAction] = useFormState(updateAction, initialState);

  if (!isEditor) {
    return (
      <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm text-ink">
          <span className={fila?.cumple ? "text-green-600" : "text-gray-400"}>
            {fila?.cumple ? "✓" : "○"}
          </span>
          {item.nombre}
          {fila?.fecha && <span className="text-xs text-gray-500">({toDateInputValue(fila.fecha)})</span>}
        </span>
        {fila?.observaciones && <span className="text-xs text-gray-500">{fila.observaciones}</span>}
      </li>
    );
  }

  return (
    <li className="px-4 py-2.5">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="cumple" defaultChecked={fila?.cumple ?? false} className="h-4 w-4" />
          <span className="truncate">{item.nombre}</span>
        </label>
        <input
          type="date"
          name="fecha"
          defaultValue={toDateInputValue(fila?.fecha)}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <input
          type="text"
          name="observaciones"
          placeholder="Observaciones"
          defaultValue={fila?.observaciones ?? ""}
          className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <GuardarButton />
      </form>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </li>
  );
}
