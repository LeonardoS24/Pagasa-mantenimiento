"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { VehicleTechnicalSheet } from "@prisma/client";
import { upsertTechnicalSheet } from "@/actions/vehicle-actions";
import type { ActionState } from "@/actions/user-actions";
import { combustibleLabels } from "@/lib/vehicle-enums";
import { toDateInputValue } from "@/lib/dates";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

function Field({
  id,
  label,
  defaultValue,
  type = "text",
  required = false,
}: {
  id: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink" htmlFor={id}>
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Guardar ficha técnica"}
    </button>
  );
}

export function TechnicalSheetForm({
  vehicleId,
  sheet,
  requireProximoUltrasonido = false,
  requireProximaInspeccionVisual = false,
}: {
  vehicleId: string;
  sheet: VehicleTechnicalSheet | null;
  requireProximoUltrasonido?: boolean;
  requireProximaInspeccionVisual?: boolean;
}) {
  const action = upsertTechnicalSheet.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Automóvil
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="fabricante" label="Fabricante" defaultValue={sheet?.fabricante} />
          <Field id="marca" label="Marca" defaultValue={sheet?.marca} />
          <Field id="linea" label="Línea" defaultValue={sheet?.linea} />
          <Field id="modelo" label="Modelo" defaultValue={sheet?.modelo} />
          <Field id="peso" label="Peso" defaultValue={sheet?.peso} />
          <Field id="serie" label="Serie" defaultValue={sheet?.serie} />
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="combustible">
              Combustible
            </label>
            <select
              id="combustible"
              name="combustible"
              defaultValue={sheet?.combustible ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Selecciona...</option>
              {Object.entries(combustibleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <Field id="ubicacion" label="Ubicación" defaultValue={sheet?.ubicacion} />
          <Field id="potencia" label="Potencia" defaultValue={sheet?.potencia} />
          <Field id="horasUsoDiario" label="Horas de uso diario" defaultValue={sheet?.horasUsoDiario} />
          <Field
            id="fechaAdquisicion"
            label="Fecha de adquisición o instalación"
            type="date"
            defaultValue={toDateInputValue(sheet?.fechaAdquisicion)}
          />
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="caracteristicas">
            Características especiales o técnicas
          </label>
          <textarea
            id="caracteristicas"
            name="caracteristicas"
            rows={3}
            defaultValue={sheet?.caracteristicas ?? ""}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Tanque
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="serieTanque" label="Serie de tanque" defaultValue={sheet?.serieTanque} />
          <Field id="capacidadTanque" label="Capacidad" defaultValue={sheet?.capacidadTanque} />
          <Field id="marcaTanque" label="Marca de tanque" defaultValue={sheet?.marcaTanque} />
          <Field
            id="anioFabricacionTanque"
            label="Año de fabricación"
            defaultValue={sheet?.anioFabricacionTanque}
          />
          <Field
            id="numeroSerieTanque"
            label="Número de serie"
            defaultValue={sheet?.numeroSerieTanque}
          />
          <Field
            id="numeroUltimoUltrasonido"
            label="Número de último ultrasonido"
            defaultValue={sheet?.numeroUltimoUltrasonido}
          />
          <Field
            id="ultimoUltrasonido"
            label="Fecha en que se realizó el último ultrasonido"
            type="date"
            defaultValue={toDateInputValue(sheet?.ultimoUltrasonido)}
          />
          <Field
            id="fechaProximoUltrasonido"
            label="Fecha próxima de ultrasonido"
            type="date"
            required={requireProximoUltrasonido}
            defaultValue={toDateInputValue(sheet?.fechaProximoUltrasonido)}
          />
        </div>
        <p className="mt-2 text-xs text-ink">
          Cuando falte un mes para la fecha próxima de ultrasonido, la unidad se marcará en
          amarillo; cuando falte una semana, se marcará en rojo con advertencias en el panel de
          alertas del inicio.
          {requireProximoUltrasonido && (
            <span className="block font-medium text-accent">
              Este campo es obligatorio para Auto-Tanques: no se puede guardar la ficha técnica
              sin la fecha próxima de ultrasonido.
            </span>
          )}
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Inspección Visual
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="numeroUltimaInspeccionVisual"
            label="Número de última inspección visual"
            defaultValue={sheet?.numeroUltimaInspeccionVisual}
          />
          <Field
            id="ultimaInspeccionVisual"
            label="Fecha en que se realizó la última inspección visual"
            type="date"
            defaultValue={toDateInputValue(sheet?.ultimaInspeccionVisual)}
          />
          <Field
            id="fechaProximaInspeccionVisual"
            label="Fecha próxima de inspección visual"
            type="date"
            required={requireProximaInspeccionVisual}
            defaultValue={toDateInputValue(sheet?.fechaProximaInspeccionVisual)}
          />
        </div>
        <p className="mt-2 text-xs text-ink">
          Cuando falte un mes para la fecha próxima de inspección visual, la unidad se marcará en
          amarillo; cuando falte una semana, se marcará en rojo con advertencias en el panel de
          alertas del inicio.
          {requireProximaInspeccionVisual && (
            <span className="block font-medium text-accent">
              Este campo es obligatorio para Auto-Tanques: no se puede guardar la ficha técnica
              sin la fecha próxima de inspección visual.
            </span>
          )}
        </p>
      </div>

      <FormMessage state={state} />

      <SubmitButton />
    </form>
  );
}
