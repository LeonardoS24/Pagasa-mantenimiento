"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import {
  updateInventoryItemEstado,
  getMantenimientosDeUnidad,
  type MantenimientoOpcion,
} from "@/actions/inventory-actions";
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
  preselectedVehicle,
}: {
  itemId: string;
  estado: string;
  vehicles: VehicleOption[];
  // Si la orden que originó esta pieza ya traía la unidad destino (ver
  // PieceOrder.vehicleRecordId), no tiene sentido volver a pedirla aquí: se
  // salta directo a elegir en qué mantenimiento se colocó.
  preselectedVehicle?: { id: string; numeroEconomico: string } | null;
}) {
  const action = updateInventoryItemEstado.bind(null, itemId);
  const [state, formAction] = useFormState(action, initialState);
  // Marcar "Utilizada" requiere elegir la unidad y el trabajo concreto donde
  // se colocó la pieza (ver actions/inventory-actions.ts), así que ese cambio
  // no se envía solo: se abre este segundo paso en vez de autoenviar.
  const [eligiendoUnidad, setEligiendoUnidad] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [mantenimientos, setMantenimientos] = useState<{
    opciones: MantenimientoOpcion[];
    nuevos: { valor: string; etiqueta: string }[];
  } | null>(null);
  const [cargando, startTransition] = useTransition();

  // Los trabajos disponibles dependen de la unidad (y de si es de carburación),
  // así que se piden al elegirla, no al pintar la tabla.
  function elegirUnidad(id: string) {
    setVehicleId(id);
    setMantenimientos(null);
    if (!id) return;
    startTransition(async () => {
      setMantenimientos(await getMantenimientosDeUnidad(id));
    });
  }

  function abrirEleccion() {
    setEligiendoUnidad(true);
    if (preselectedVehicle) {
      elegirUnidad(preselectedVehicle.id);
    }
  }

  if (eligiendoUnidad) {
    const groups = new Map<string, VehicleOption[]>();
    for (const vehicle of vehicles) {
      const list = groups.get(vehicle.section.name) ?? [];
      list.push(vehicle);
      groups.set(vehicle.section.name, list);
    }

    const gruposMantenimiento = new Map<string, MantenimientoOpcion[]>();
    for (const opcion of mantenimientos?.opciones ?? []) {
      const list = gruposMantenimiento.get(opcion.grupo) ?? [];
      list.push(opcion);
      gruposMantenimiento.set(opcion.grupo, list);
    }

    return (
      <form action={formAction} className="flex flex-col items-start gap-1">
        <input type="hidden" name="estado" value="UTILIZADA" />

        {preselectedVehicle ? (
          <>
            <input type="hidden" name="vehicleRecordId" value={preselectedVehicle.id} />
            <span className="text-xs text-ink">
              Unidad (de la orden): <span className="font-medium text-primary">{preselectedVehicle.numeroEconomico}</span>
            </span>
          </>
        ) : (
          <select
            name="vehicleRecordId"
            required
            value={vehicleId}
            onChange={(event) => elegirUnidad(event.target.value)}
            className={selectClass}
          >
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
        )}

        {vehicleId && cargando && (
          <span className="text-xs text-ink">Buscando los mantenimientos de la unidad...</span>
        )}

        {vehicleId && !cargando && mantenimientos && (
          <select name="destino" required defaultValue="" className={selectClass}>
            <option value="" disabled>
              ¿En qué mantenimiento se colocó?
            </option>
            {Array.from(gruposMantenimiento.entries()).map(([grupo, opciones]) => (
              <optgroup key={grupo} label={grupo}>
                {opciones.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </optgroup>
            ))}
            <optgroup label="Todavía no está registrado">
              {mantenimientos.nuevos.map((n) => (
                <option key={n.valor} value={n.valor}>
                  {n.etiqueta}
                </option>
              ))}
            </optgroup>
          </select>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!vehicleId || cargando}
            className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
          >
            Aceptar
          </button>
          <button
            type="button"
            onClick={() => {
              setEligiendoUnidad(false);
              setVehicleId("");
              setMantenimientos(null);
            }}
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
            abrirEleccion();
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
