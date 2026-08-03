"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { VehicleTechnicalSheet } from "@prisma/client";
import { upsertTechnicalSheet } from "@/actions/vehicle-actions";
import type { ActionState } from "@/actions/user-actions";
import { combustibleLabels, calidadExtintorLabels } from "@/lib/vehicle-enums";
import { toDateInputValue } from "@/lib/dates";
import { getExtinguisherAlertLevel, extinguisherAlertBadgeStyles, extinguisherAlertLabel } from "@/lib/extinguisher-alerts";
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
  requireProximaPruebaHermeticidad = false,
  useDeliveryFormat = false,
}: {
  vehicleId: string;
  sheet: VehicleTechnicalSheet | null;
  requireProximoUltrasonido?: boolean;
  requireProximaInspeccionVisual?: boolean;
  requireProximaPruebaHermeticidad?: boolean;
  // Formato para Vehículo de reparto y Vehículo con tanque de carburación:
  // "Peso" se reemplaza por dos pesos brutos y "Tanque" pasa a llamarse
  // "Tanque de carburación".
  useDeliveryFormat?: boolean;
}) {
  const action = upsertTechnicalSheet.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  const extinguisherAlertLevel = getExtinguisherAlertLevel(
    sheet?.calidadExtintor,
    sheet?.fechaCalidadMalaExtintor
  );

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
          {useDeliveryFormat ? (
            <>
              <Field
                id="pesoBrutoVacio"
                label="Peso bruto de unidad vacía"
                defaultValue={sheet?.pesoBrutoVacio}
              />
              <Field
                id="pesoBrutoMaximo"
                label="Peso bruto de unidad con peso máximo"
                defaultValue={sheet?.pesoBrutoMaximo}
              />
            </>
          ) : (
            <Field id="peso" label="Peso" defaultValue={sheet?.peso} />
          )}
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
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Extintor</h3>
          {extinguisherAlertLevel !== "none" && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${extinguisherAlertBadgeStyles[extinguisherAlertLevel]}`}
            >
              {extinguisherAlertLabel(extinguisherAlertLevel, sheet?.fechaCalidadMalaExtintor)}
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="fechaInstalacionExtintor"
            label="Fecha de instalación"
            type="date"
            defaultValue={toDateInputValue(sheet?.fechaInstalacionExtintor)}
          />
          <Field
            id="fechaVencimientoExtintor"
            label="Fecha de vencimiento"
            type="date"
            defaultValue={toDateInputValue(sheet?.fechaVencimientoExtintor)}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="calidadExtintor">
              Calidad
            </label>
            <select
              id="calidadExtintor"
              name="calidadExtintor"
              defaultValue={sheet?.calidadExtintor ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Selecciona...</option>
              {Object.entries(calidadExtintorLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-ink">
          Cuando la calidad se marca como "Mala" se genera una alerta para reemplazar el
          extintor: amarilla los primeros 2 días, roja a partir del día 2.
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          {useDeliveryFormat ? "Tanque de carburación" : "Tanque"}
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
            id="fechaFabricacionTanque"
            label="Fecha de fabricación"
            type="date"
            defaultValue={toDateInputValue(sheet?.fechaFabricacionTanque)}
          />
          <Field
            id="numeroSerieTanque"
            label="Número de serie"
            defaultValue={sheet?.numeroSerieTanque}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Ultrasonido
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
          Inspección Visual Externa
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="numeroUltimaInspeccionVisual"
            label="Número de última inspección visual externa"
            defaultValue={sheet?.numeroUltimaInspeccionVisual}
          />
          <Field
            id="ultimaInspeccionVisual"
            label="Fecha en que se realizó la última inspección visual externa"
            type="date"
            defaultValue={toDateInputValue(sheet?.ultimaInspeccionVisual)}
          />
          <Field
            id="fechaProximaInspeccionVisual"
            label="Fecha próxima de inspección visual externa"
            type="date"
            required={requireProximaInspeccionVisual}
            defaultValue={toDateInputValue(sheet?.fechaProximaInspeccionVisual)}
          />
        </div>
        <p className="mt-2 text-xs text-ink">
          Cuando falte un mes para la fecha próxima de inspección visual externa, la unidad se
          marcará en amarillo; cuando falte una semana, se marcará en rojo con advertencias en el
          panel de alertas del inicio.
          {requireProximaInspeccionVisual && (
            <span className="block font-medium text-accent">
              Este campo es obligatorio para Auto-Tanques: no se puede guardar la ficha técnica
              sin la fecha próxima de inspección visual externa.
            </span>
          )}
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Prueba de Hermeticidad
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="numeroUltimaPruebaHermeticidad"
            label="Número de última prueba de hermeticidad"
            defaultValue={sheet?.numeroUltimaPruebaHermeticidad}
          />
          <Field
            id="ultimaPruebaHermeticidad"
            label="Fecha en que se realizó la última prueba de hermeticidad"
            type="date"
            defaultValue={toDateInputValue(sheet?.ultimaPruebaHermeticidad)}
          />
          <Field
            id="fechaProximaPruebaHermeticidad"
            label="Fecha próxima de prueba de hermeticidad"
            type="date"
            required={requireProximaPruebaHermeticidad}
            defaultValue={toDateInputValue(sheet?.fechaProximaPruebaHermeticidad)}
          />
        </div>
        <p className="mt-2 text-xs text-ink">
          Se revisa típicamente cada año. Cuando falte un mes para la fecha próxima, la unidad se
          marcará en amarillo; cuando falte una semana, se marcará en rojo con advertencias en el
          panel de alertas del inicio.
          {requireProximaPruebaHermeticidad && (
            <span className="block font-medium text-accent">
              Este campo es obligatorio para Auto-Tanques: no se puede guardar la ficha técnica
              sin la fecha próxima de prueba de hermeticidad.
            </span>
          )}
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Inspección Visual Interna
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="numeroUltimaInspeccionVisualInterna"
            label="Número de última inspección visual interna"
            defaultValue={sheet?.numeroUltimaInspeccionVisualInterna}
          />
          <Field
            id="ultimaInspeccionVisualInterna"
            label="Fecha en que se realizó la última inspección visual interna"
            type="date"
            defaultValue={toDateInputValue(sheet?.ultimaInspeccionVisualInterna)}
          />
          <Field
            id="fechaProximaInspeccionVisualInterna"
            label="Fecha próxima de inspección visual interna"
            type="date"
            defaultValue={toDateInputValue(sheet?.fechaProximaInspeccionVisualInterna)}
          />
        </div>
        <p className="mt-2 text-xs text-ink">
          Vence cada 10 años a partir de la fecha de fabricación del tanque. Si se deja vacía, se
          calcula sola al guardar; cada vez que se acepte un registro nuevo se recorre otros 10
          años. Marca en amarillo/rojo con advertencias en el panel de alertas del inicio, igual
          que las demás pruebas.
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Prueba Hidrostática
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            id="numeroUltimaPruebaHidrostatica"
            label="Número de última prueba hidrostática"
            defaultValue={sheet?.numeroUltimaPruebaHidrostatica}
          />
          <Field
            id="ultimaPruebaHidrostatica"
            label="Fecha en que se realizó la última prueba hidrostática"
            type="date"
            defaultValue={toDateInputValue(sheet?.ultimaPruebaHidrostatica)}
          />
          <Field
            id="fechaProximaPruebaHidrostatica"
            label="Fecha próxima de prueba hidrostática"
            type="date"
            defaultValue={toDateInputValue(sheet?.fechaProximaPruebaHidrostatica)}
          />
        </div>
        <p className="mt-2 text-xs text-ink">
          Vence cada 10 años a partir de la fecha de fabricación del tanque, con el mismo cálculo
          automático que la inspección visual interna.
        </p>
      </div>

      <FormMessage state={state} />

      <SubmitButton />
    </form>
  );
}
