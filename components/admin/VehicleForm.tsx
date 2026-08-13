"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

type VehicleFormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export interface VehicleFormDefaults {
  numeroEconomico?: string;
  sucursal?: string;
  anio?: string | null;
  placas?: string | null;
  observaciones?: string | null;
  permisionaria?: string | null;
  permiso?: string | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

export function VehicleForm({
  action,
  defaults,
  submitLabel,
  // "Estaciones de carburación" (ver scripts/add-estaciones-de-carburacion.mjs)
  // no es un vehículo: reutiliza numeroEconomico/sucursal como
  // "Nombre"/"Dirección" (junto con Permisionaria/Permiso, todo en un solo
  // formulario — "la ficha técnica de la estación" — sin separar Dirección
  // en otro lado) y no pide año/placas.
  isEstacion = false,
  // "Planta" (ver scripts/restructure-planta-section.mjs) usa isEstacion=true
  // igual que una Estación (mismos campos), pero el texto del banner de
  // bloqueo dice "la planta" en vez de "la estación".
  stationLabel = "la estación",
  // true al editar una unidad ya existente (empieza bloqueada con un botón
  // "Editar", mismo patrón que TechnicalSheetForm.tsx, para no cambiar los
  // datos generales sin querer con solo dar clic). false en CreateVehicleForm
  // (dar de alta no tiene nada que "bloquear").
  lockable = false,
}: {
  action: VehicleFormAction;
  defaults?: VehicleFormDefaults;
  submitLabel: string;
  isEstacion?: boolean;
  stationLabel?: string;
  lockable?: boolean;
}) {
  const [state, formAction] = useFormState(action, initialState);
  const [locked, setLocked] = useState(lockable);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCancel() {
    formRef.current?.reset();
    setLocked(true);
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {lockable && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-2">
          <p className="text-sm text-ink">
            {locked
              ? isEstacion
                ? `La ficha técnica de ${stationLabel} está bloqueada para evitar cambios por accidente.`
                : "Los datos generales están bloqueados para evitar cambios por accidente."
              : isEstacion
                ? `Editando la ficha técnica de ${stationLabel}.`
                : "Editando los datos generales."}
          </p>
          {locked ? (
            <button
              type="button"
              onClick={() => setLocked(false)}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white transition hover:bg-primary-dark"
            >
              Editar
            </button>
          ) : (
            <button type="button" onClick={handleCancel} className="text-sm text-ink hover:underline">
              Cancelar
            </button>
          )}
        </div>
      )}

      <fieldset disabled={locked} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="numeroEconomico">
              {isEstacion ? "Nombre" : "Número económico"}
            </label>
            <input
              id="numeroEconomico"
              name="numeroEconomico"
              defaultValue={defaults?.numeroEconomico}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
            />
          </div>
          {isEstacion ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="permisionaria">
                  Permisionaria
                </label>
                <input
                  id="permisionaria"
                  name="permisionaria"
                  defaultValue={defaults?.permisionaria ?? ""}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="permiso">
                  Permiso
                </label>
                <input
                  id="permiso"
                  name="permiso"
                  defaultValue={defaults?.permiso ?? ""}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="sucursal">
                  Dirección (opcional)
                </label>
                <textarea
                  id="sucursal"
                  name="sucursal"
                  rows={3}
                  defaultValue={defaults?.sucursal}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="sucursal">
                  Marca
                </label>
                <input
                  id="sucursal"
                  name="sucursal"
                  defaultValue={defaults?.sucursal}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="anio">
                  Año
                </label>
                <input
                  id="anio"
                  name="anio"
                  defaultValue={defaults?.anio ?? ""}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="placas">
                  Placas
                </label>
                <input
                  id="placas"
                  name="placas"
                  defaultValue={defaults?.placas ?? ""}
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="observaciones">
                  Observaciones (opcional)
                </label>
                <textarea
                  id="observaciones"
                  name="observaciones"
                  rows={2}
                  defaultValue={defaults?.observaciones ?? ""}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
                />
              </div>
            </>
          )}
        </div>
      </fieldset>

      <FormMessage state={state} />

      {(!lockable || !locked) && <SubmitButton label={submitLabel} />}
    </form>
  );
}
