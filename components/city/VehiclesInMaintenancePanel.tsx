"use client";

import { useTransition } from "react";
import Link from "next/link";
import type { VehicleInMaintenanceRow } from "@/lib/aggregate-listings";
import { setVehicleEstatus } from "@/actions/vehicle-actions";

// Todas las unidades en taller de todas las ciudades, con un botón para
// marcarlas operativas sin tener que entrar a cada una — mismo criterio que
// HighCriticidadEquiposPanel.tsx (que un auto en taller nunca pase
// desapercibido en Administración). Marcar "Operativa" aquí cierra también
// los mantenimientos abiertos de esa unidad (ver setVehicleEstatus en
// actions/vehicle-actions.ts).
export function VehiclesInMaintenancePanel({ vehicles }: { vehicles: VehicleInMaintenanceRow[] }) {
  const [isPending, startTransition] = useTransition();

  if (vehicles.length === 0) return null;

  function marcarOperativa(vehicleId: string) {
    const formData = new FormData();
    formData.set("estatus", "OPERATIVA");
    startTransition(async () => {
      await setVehicleEstatus(vehicleId, {}, formData);
    });
  }

  return (
    <div className="rounded-lg border border-accent/30 bg-white p-5">
      <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-accent">Autos en taller</h2>
      <p className="mb-3 text-xs text-gray-500">
        Unidades activas marcadas &quot;En taller&quot; en cualquier ciudad. Al marcarlas Operativa se
        cierran también sus mantenimientos abiertos.
      </p>
      <ul className="space-y-2">
        {vehicles.map((vehicle) => (
          <li
            key={vehicle.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-accent-light/10 px-3 py-2 text-sm"
          >
            <span className="text-ink">
              <Link
                href={`/ciudades/${vehicle.citySlug}/vehiculo/${vehicle.id}`}
                className="font-medium text-primary hover:underline"
              >
                {vehicle.numeroEconomico}
              </Link>{" "}
              <span className="text-gray-500">
                ({vehicle.cityName} · {vehicle.sectionName})
              </span>
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => marcarOperativa(vehicle.id)}
              className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
            >
              Marcar operativa
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
