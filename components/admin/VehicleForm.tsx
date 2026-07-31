"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

type VehicleFormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export interface VehicleFormDefaults {
  numeroEconomico?: string;
  sucursal?: string;
  anio?: string;
  placas?: string;
  numeroAnterior?: string | null;
  localidadAnterior?: string | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

export function VehicleForm({
  action,
  defaults,
  submitLabel,
}: {
  action: VehicleFormAction;
  defaults?: VehicleFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="numeroEconomico">
            Número económico
          </label>
          <input
            id="numeroEconomico"
            name="numeroEconomico"
            defaultValue={defaults?.numeroEconomico}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="sucursal">
            Sucursal
          </label>
          <input
            id="sucursal"
            name="sucursal"
            defaultValue={defaults?.sucursal}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="anio">
            Año
          </label>
          <input
            id="anio"
            name="anio"
            defaultValue={defaults?.anio}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="placas">
            Placas
          </label>
          <input
            id="placas"
            name="placas"
            defaultValue={defaults?.placas}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="numeroAnterior">
            Número anterior (opcional)
          </label>
          <input
            id="numeroAnterior"
            name="numeroAnterior"
            defaultValue={defaults?.numeroAnterior ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="localidadAnterior">
            Localidad anterior (opcional)
          </label>
          <input
            id="localidadAnterior"
            name="localidadAnterior"
            defaultValue={defaults?.localidadAnterior ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <FormMessage state={state} />

      <SubmitButton label={submitLabel} />
    </form>
  );
}
