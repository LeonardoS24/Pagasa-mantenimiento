"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createPieceOrder } from "@/actions/piece-order-actions";
import type { ActionState } from "@/actions/user-actions";
import {
  ordenTipoLabels,
  consumibleUnidadLabels,
  ordenNombreLabels,
  ordenNombrePlaceholders,
  pieceOrderStatusLabels,
  formatCantidad,
  unidadParaTipo,
  type OrdenTipo,
  type ConsumibleUnidad,
} from "@/lib/inventory-enums";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Registrar orden"}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export type VehicleOption = { id: string; numeroEconomico: string; section: { name: string } };

export function CreatePieceOrderForm({
  sectionId,
  vehicles,
}: {
  sectionId: string;
  vehicles: VehicleOption[];
}) {
  const action = createPieceOrder.bind(null, sectionId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // La unidad no se captura: se deduce del tipo. Solo el consumible deja
  // elegir entre litros y kilos, y ese selector aparece únicamente entonces.
  const [tipo, setTipo] = useState<OrdenTipo | "">("");
  const [unidadConsumible, setUnidadConsumible] = useState<ConsumibleUnidad>("LTS");
  const [cantidad, setCantidad] = useState("1");

  const esConsumible = tipo === "CONSUMIBLE";
  const unidad = tipo ? unidadParaTipo(tipo, unidadConsumible) : null;
  const cantidadNum = Number(cantidad);
  const vistaPrevia =
    unidad && Number.isInteger(cantidadNum) && cantidadNum >= 1
      ? formatCantidad(cantidadNum, unidad)
      : null;

  return (
    <details className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Registrar orden
      </summary>

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
          setTipo("");
          setUnidadConsumible("LTS");
          setCantidad("1");
        }}
        className="mt-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="op-tipo">
              Orden
            </label>
            <select
              id="op-tipo"
              name="tipo"
              required
              value={tipo}
              onChange={(event) => setTipo(event.target.value as OrdenTipo | "")}
              className={inputClass}
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {Object.entries(ordenTipoLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="op-nombre">
              {tipo ? ordenNombreLabels[tipo] : "Nombre"}
            </label>
            <input
              id="op-nombre"
              name="nombre"
              required
              disabled={!tipo}
              placeholder={tipo ? ordenNombrePlaceholders[tipo] : "Elige primero el tipo"}
              className={`${inputClass} disabled:bg-gray-50 disabled:text-gray-400`}
            />
          </div>

          {esConsumible && (
            <div>
              <label
                className="mb-1 block text-sm font-medium text-ink"
                htmlFor="op-unidadConsumible"
              >
                Unidad
              </label>
              <select
                id="op-unidadConsumible"
                name="unidadConsumible"
                required
                value={unidadConsumible}
                onChange={(event) => setUnidadConsumible(event.target.value as ConsumibleUnidad)}
                className={inputClass}
              >
                {Object.entries(consumibleUnidadLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="op-cantidad">
              Cantidad
            </label>
            <input
              id="op-cantidad"
              name="cantidad"
              type="number"
              min={1}
              max={1000}
              step={1}
              required
              value={cantidad}
              onChange={(event) => setCantidad(event.target.value)}
              className={inputClass}
            />
            {vistaPrevia && (
              <p className="mt-1 text-xs text-gray-500">Se registrará como: {vistaPrevia}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="op-fechaOrden">
              Fecha de la orden
            </label>
            <input
              id="op-fechaOrden"
              name="fechaOrden"
              type="date"
              required
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="op-estado">
              Estatus
            </label>
            <select id="op-estado" name="estado" defaultValue="PENDIENTE" className={inputClass}>
              {Object.entries(pieceOrderStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="op-vehicleRecordId">
              Unidad destino (opcional, si ya se sabe)
            </label>
            <select id="op-vehicleRecordId" name="vehicleRecordId" defaultValue="" className={inputClass}>
              <option value="">— Se elige después, desde Inventarios —</option>
              {Array.from(
                vehicles.reduce((groups, vehicle) => {
                  const list = groups.get(vehicle.section.name) ?? [];
                  list.push(vehicle);
                  groups.set(vehicle.section.name, list);
                  return groups;
                }, new Map<string, typeof vehicles>())
              ).map(([sectionName, options]) => (
                <optgroup key={sectionName} label={sectionName}>
                  {options.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.numeroEconomico}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <p className="text-xs text-ink">
          Si ya sabes para qué unidad es la pieza, selecciónala aquí: al aceptarse la orden, el
          renglón de inventario ya queda amarrado a esa unidad y al marcarlo &quot;Utilizada&quot;
          ya no habrá que elegirla de nuevo.
        </p>

        {tipo && (
          <p className="text-xs text-ink">
            {esConsumible
              ? "Al aceptarse, el consumible entrará al inventario como un solo registro con la cantidad total."
              : `Al aceptarse, entrarán al inventario ${cantidadNum >= 1 ? cantidadNum : 1} registro(s) independiente(s), uno por cada unidad.`}
          </p>
        )}

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
