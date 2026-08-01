"use client";

import { useFormState } from "react-dom";
import { updatePieceOrderEstado } from "@/actions/piece-order-actions";
import type { ActionState } from "@/actions/user-actions";
import { pieceOrderStatusLabels } from "@/lib/inventory-enums";

const initialState: ActionState = {};

export function PieceOrderStatusForm({ orderId, estado }: { orderId: string; estado: string }) {
  const action = updatePieceOrderEstado.bind(null, orderId);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <select
        name="estado"
        defaultValue={estado}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {Object.entries(pieceOrderStatusLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
