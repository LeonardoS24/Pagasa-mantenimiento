"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { StationTankTechnicalSheet } from "@prisma/client";
import { upsertStationTankTechnicalSheet } from "@/actions/vehicle-actions";
import type { ActionState } from "@/actions/user-actions";
import { toDateInputValue } from "@/lib/dates";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

function Field({
  id,
  label,
  defaultValue,
  type = "text",
}: {
  id: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
      />
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Guardar ficha técnica del tanque"}
    </button>
  );
}

// Ficha técnica propia del tanque de una Estación de carburación: distinta
// de TechnicalSheetForm (pensada para el tanque de carga de un Auto-Tanque)
// y también distinta de "la ficha técnica de la estación" (Nombre,
// Permisionaria, Permiso y Dirección, ver VehicleForm.tsx) — esta es solo el
// vocabulario de un recipiente a presión fijo (ver StationTankTechnicalSheet
// en el schema), sin mezclar los datos generales de la estación.
export function StationTankTechnicalSheetForm({
  vehicleId,
  sheet,
}: {
  vehicleId: string;
  sheet: StationTankTechnicalSheet | null;
}) {
  const action = upsertStationTankTechnicalSheet.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  const [locked, setLocked] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCancel() {
    formRef.current?.reset();
    setLocked(true);
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-2">
        <p className="text-sm text-ink">
          {locked
            ? "La ficha técnica del tanque está bloqueada para evitar cambios por accidente."
            : "Editando la ficha técnica del tanque."}
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

      <fieldset disabled={locked} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="numeroSerie" label="Número de serie" defaultValue={sheet?.numeroSerie} />
          <Field id="marca" label="Marca" defaultValue={sheet?.marca} />
          <Field id="modelo" label="Modelo" defaultValue={sheet?.modelo} />
          <Field id="tipo" label="Tipo" defaultValue={sheet?.tipo} />
          <Field id="anioFabricacion" label="Año de fabricación" defaultValue={sheet?.anioFabricacion} />
          <Field
            id="fechaFabricacion"
            label="Fecha de fabricación"
            type="date"
            defaultValue={toDateInputValue(sheet?.fechaFabricacion)}
          />
          <Field id="capacidad" label="Capacidad (lts)" defaultValue={sheet?.capacidad} />
          <Field id="presionDiseno" label="Presión de diseño" defaultValue={sheet?.presionDiseno} />
          <Field id="longitudTotal" label="Longitud total" defaultValue={sheet?.longitudTotal} />
          <Field id="formaCabeza" label="Forma de la cabeza" defaultValue={sheet?.formaCabeza} />
          <Field
            id="espesorNominalCuerpo"
            label="Espesor nominal del cuerpo"
            defaultValue={sheet?.espesorNominalCuerpo}
          />
          <Field
            id="espesorNominalCabeza"
            label="Espesor nominal de la cabeza"
            defaultValue={sheet?.espesorNominalCabeza}
          />
          <Field id="materialCuerpo" label="Material del cuerpo" defaultValue={sheet?.materialCuerpo} />
          <Field id="materialCabeza" label="Material cabeza" defaultValue={sheet?.materialCabeza} />
          <Field id="diametroInterior" label="Diámetro interior" defaultValue={sheet?.diametroInterior} />
          <Field id="tara" label="Tara" defaultValue={sheet?.tara} />
        </div>
      </fieldset>

      <FormMessage state={state} />

      {!locked && <SubmitButton />}
    </form>
  );
}
