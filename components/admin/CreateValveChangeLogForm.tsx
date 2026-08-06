"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { createValveChangeLog } from "@/actions/valve-actions";
import type { ActionState } from "@/actions/user-actions";
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
      {pending ? "Guardando..." : "Aceptar"}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function CreateValveChangeLogForm({ vehicleId }: { vehicleId: string }) {
  const action = createValveChangeLog.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const searchParams = useSearchParams();

  // Id de la pieza de inventario que quedó esperando este registro para
  // amarrarse a él (ver vincularPiezaARegistro).
  const vincularPieza = searchParams.get("vincularPieza") ?? "";

  useEffect(() => {
    if (vincularPieza && detailsRef.current) {
      detailsRef.current.open = true;
    }
  }, [vincularPieza]);

  return (
    <details ref={detailsRef} className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Registrar cambio de válvulas
      </summary>

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-4 space-y-3"
      >
        {vincularPieza && <input type="hidden" name="vincularPieza" value={vincularPieza} />}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="valv-responsable">
              Responsable
            </label>
            <input id="valv-responsable" name="responsable" className={inputClass} />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="valv-fechaInstalacion"
            >
              Fecha de instalación
            </label>
            <input
              id="valv-fechaInstalacion"
              name="fechaInstalacion"
              type="date"
              required
              className={inputClass}
            />
          </div>
        </div>

        <p className="text-xs font-semibold uppercase text-gray-500">
          Fecha de fabricación de cada válvula
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="valv-fechaFabricacionValvulaLlenado"
            >
              Válvula de llenado
            </label>
            <input
              id="valv-fechaFabricacionValvulaLlenado"
              name="fechaFabricacionValvulaLlenado"
              type="date"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="valv-fechaFabricacionValvulaServicio"
            >
              Válvula de servicio
            </label>
            <input
              id="valv-fechaFabricacionValvulaServicio"
              name="fechaFabricacionValvulaServicio"
              type="date"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="valv-fechaFabricacionValvulaMaximoLlenado"
            >
              Válvula de máximo llenado
            </label>
            <input
              id="valv-fechaFabricacionValvulaMaximoLlenado"
              name="fechaFabricacionValvulaMaximoLlenado"
              type="date"
              required
              className={inputClass}
            />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="valv-fechaFabricacionValvulaAlivio"
            >
              Válvula de alivio (seguridad)
            </label>
            <input
              id="valv-fechaFabricacionValvulaAlivio"
              name="fechaFabricacionValvulaAlivio"
              type="date"
              required
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="valv-files">
            Documentos (PDF o imagen, opcional)
          </label>
          <input
            id="valv-files"
            name="files"
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
          />
        </div>

        <p className="text-xs text-ink">
          Al aceptar, la ficha técnica actualizará automáticamente las 4 fechas de fabricación y
          la fecha de instalación. El aviso de cambio se calcula sobre la válvula con la fecha de
          fabricación más antigua: vence a los 5 años.
        </p>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
