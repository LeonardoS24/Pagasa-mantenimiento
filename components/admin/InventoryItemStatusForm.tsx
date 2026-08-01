"use client";

import { useFormState } from "react-dom";
import { updateInventoryItemEstado } from "@/actions/inventory-actions";
import type { ActionState } from "@/actions/user-actions";
import { inventoryItemStatusLabels } from "@/lib/inventory-enums";

const initialState: ActionState = {};

export function InventoryItemStatusForm({ itemId, estado }: { itemId: string; estado: string }) {
  const action = updateInventoryItemEstado.bind(null, itemId);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <select
        name="estado"
        defaultValue={estado}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {Object.entries(inventoryItemStatusLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
