"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createEquipmentLog } from "@/actions/equipment-log-actions";
import {
  equipmentLogTipoOptions,
  plantaEquipmentLogTipoOptions,
  criticidadEquipoSchema,
  criticidadEquipoLabels,
} from "@/lib/equipo-enums";
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
      {pending ? "Guardando..." : "Registrar"}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function CreateEquipmentLogForm({
  equipoId,
  isPlanta = false,
}: {
  equipoId: string;
  // Equipos de Planta (ver lib/equipo-enums.ts: plantaEquipmentLogTipoSchema):
  // Inspección/Prueba/Calibración/Reemplazo/Certificación en vez de
  // Preventivo/Correctivo/Predictivo/Cambio.
  isPlanta?: boolean;
}) {
  const action = createEquipmentLog.bind(null, equipoId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const tipoOptions = isPlanta ? plantaEquipmentLogTipoOptions : equipmentLogTipoOptions;
  const tipoCambio = isPlanta ? "Reemplazo" : "Cambio";
  const [tipo, setTipo] = useState(isPlanta ? "Inspección" : "Preventivo");

  return (
    <details className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Registrar mantenimiento de equipo
      </summary>

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="mt-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="eq-tipoMantenimiento">
              Tipo de mantenimiento
            </label>
            <select
              id="eq-tipoMantenimiento"
              name="tipoMantenimiento"
              required
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={inputClass}
            >
              {tipoOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="eq-fecha">
              Fecha
            </label>
            <input id="eq-fecha" name="fecha" type="date" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="eq-responsable">
              Responsable
            </label>
            <input id="eq-responsable" name="responsable" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="eq-criticidad">
              Criticidad del equipo
            </label>
            <select id="eq-criticidad" name="criticidad" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Selecciona...
              </option>
              {criticidadEquipoSchema.options.map((opt) => (
                <option key={opt} value={opt}>
                  {criticidadEquipoLabels[opt]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="eq-descripcion">
            Descripción
          </label>
          <textarea id="eq-descripcion" name="descripcion" required rows={2} className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="eq-observacion">
            Observación (opcional)
          </label>
          <textarea id="eq-observacion" name="observacion" rows={2} className={inputClass} />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="eq-files">
            Documentos (PDF o imagen, opcional)
          </label>
          <input
            id="eq-files"
            name="files"
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
          />
        </div>

        {tipo === tipoCambio && (
          <p className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-xs text-orange-900">
            Al aceptar, este equipo se dará de baja y se creará uno nuevo del mismo tipo en su
            lugar. Se te llevará directo a su ficha técnica para llenarla.
          </p>
        )}

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
