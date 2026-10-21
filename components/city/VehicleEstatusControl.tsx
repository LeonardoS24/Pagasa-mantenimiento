"use client";

import { useState, useTransition } from "react";
import { setVehicleEstatus } from "@/actions/vehicle-actions";
import {
  vehicleEstatusLabels,
  vehicleEstatusStyles,
  vehicleEstatusSchema,
  vehicleEstatusTransitions,
  type VehicleEstatus,
} from "@/lib/vehicle-enums";

// Botón/select de "fácil acceso" para cambiar el estatus operativo de una
// unidad directo desde el listado (ver VehicleTable.tsx/AggregateVehicleTable.tsx),
// sin tener que entrar a la unidad. Vive dentro de un <tr> que además tiene
// un <Link> cubriendo toda la fila (mismo truco que el link al número
// económico): por eso el <td> que lo envuelve necesita z-10 para que el
// clic caiga en el select y no en el link de abajo.
export function VehicleEstatusControl({
  vehicleId,
  estatus,
  activo = true,
}: {
  vehicleId: string;
  estatus: string;
  // Dada de baja = fuera de servicio, sin selector: para volver a operar hay
  // que reactivarla desde su ficha (ver setVehicleActive).
  activo?: boolean;
}) {
  const [current, setCurrent] = useState<VehicleEstatus>(
    vehicleEstatusSchema.options.includes(estatus as VehicleEstatus) ? (estatus as VehicleEstatus) : "OPERATIVA"
  );
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value as VehicleEstatus;
    const previous = current;
    setCurrent(value);
    const formData = new FormData();
    formData.set("estatus", value);
    startTransition(async () => {
      const result = await setVehicleEstatus(vehicleId, {}, formData);
      if (result.error) setCurrent(previous);
    });
  }

  // Solo el estatus actual + a los que sí se puede pasar a mano desde él
  // (ver vehicleEstatusTransitions en lib/vehicle-enums.ts): p.ej. estando
  // Operativa no aparece "En taller", porque a taller entra sola al
  // registrarle un mantenimiento.
  const options: VehicleEstatus[] = [current, ...vehicleEstatusTransitions[current]];

  if (!activo) {
    return (
      <span
        className={`rounded-full px-2 py-1 text-xs font-medium ${vehicleEstatusStyles.FUERA_DE_SERVICIO}`}
        title="Dada de baja: reactívala desde su ficha para volver a operar"
      >
        {vehicleEstatusLabels.FUERA_DE_SERVICIO}
      </span>
    );
  }

  return (
    <select
      value={current}
      onChange={handleChange}
      onClick={(e) => e.stopPropagation()}
      disabled={isPending}
      className={`rounded-full border-0 px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60 ${vehicleEstatusStyles[current]}`}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {vehicleEstatusLabels[opt]}
        </option>
      ))}
    </select>
  );
}
