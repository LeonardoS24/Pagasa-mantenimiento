"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { updateInventoryItemEstado } from "@/actions/inventory-actions";
import type { ActionState } from "@/actions/user-actions";
import { inventoryItemStatusLabels } from "@/lib/inventory-enums";

const initialState: ActionState = {};

export type VehicleOption = {
  id: string;
  numeroEconomico: string;
  section: { name: string };
};

const selectClass =
  "rounded-md border border-gray-300 px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function InventoryItemStatusForm({
  itemId,
  estado,
  vehicles,
}: {
  itemId: string;
  estado: string;
  vehicles: VehicleOption[];
}) {
  const action = updateInventoryItemEstado.bind(null, itemId);
  const [state, formAction] = useFormState(action, initialState);
  // Marcar "Utilizada" requiere primero elegir en qué unidad se colocó la
  // pieza (ver actions/inventory-actions.ts), así que ese cambio no se
  // envía solo: se abre este segundo paso en vez de autoenviar.
  const [eligiendoUnidad, setEligiendoUnidad] = useState(false);

  if (eligiendoUnidad) {
    const groups = new Map<string, VehicleOption[]>();
    for (const vehicle of vehicles) {
      const list = groups.get(vehicle.section.name) ?? [];
      list.push(vehicle);
      groups.set(vehicle.section.name, list);
    }

    return (
      <form action={formAction} className="flex flex-col items-start gap-1">
        <input type="hidden" name="estado" value="UTILIZADA" />
        <select name="vehicleRecordId" required defaultValue="" className={selectClass}>
          <option value="" disabled>
            Selecciona la unidad...
          </option>
          {Array.from(groups.entries()).map(([sectionName, options]) => (
            <optgroup key={sectionName} label={sectionName}>
              {options.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.numeroEconomico}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-dark"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={() => setEligiendoUnidad(false)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-ink hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
        {vehicles.length === 0 && (
          <p className="text-xs text-red-600">No hay unidades activas en esta ciudad.</p>
        )}
        {state.error && <span className="text-xs text-red-600">{state.error}</span>}
      </form>
    );
  }

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <select
        name="estado"
        defaultValue={estado}
        onChange={(event) => {
          if (event.target.value === "UTILIZADA") {
            setEligiendoUnidad(true);
          } else {
            event.currentTarget.form?.requestSubmit();
          }
        }}
        className={selectClass}
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
