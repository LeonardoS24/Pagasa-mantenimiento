"use client";

import { useFormState } from "react-dom";
import { updateCalidadExtintor } from "@/actions/vehicle-actions";
import type { ActionState } from "@/actions/user-actions";
import { calidadExtintorSchema, calidadExtintorLabels, type CalidadExtintor } from "@/lib/vehicle-enums";

const initialState: ActionState = {};

// Cambio rápido de solo la calidad del extintor, sin tener que apretar
// "Editar" y desbloquear toda la ficha técnica solo para esto (ver
// actions/vehicle-actions.ts: updateCalidadExtintor).
export function QuickCalidadExtintorForm({
  vehicleId,
  calidadActual,
}: {
  vehicleId: string;
  calidadActual: string | null;
}) {
  const action = updateCalidadExtintor.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor="calidadExtintor-quick">
          Calidad del extintor
        </label>
        <select
          id="calidadExtintor-quick"
          name="calidadExtintor"
          defaultValue={calidadActual ?? ""}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          <option value="" disabled>
            Selecciona...
          </option>
          {calidadExtintorSchema.options.map((opt) => (
            <option key={opt} value={opt}>
              {calidadExtintorLabels[opt as CalidadExtintor]}
            </option>
          ))}
        </select>
      </div>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      {state.success && <span className="text-xs text-green-700">{state.success}</span>}
    </form>
  );
}
