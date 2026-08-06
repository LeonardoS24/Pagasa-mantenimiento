"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { createMaintenanceLog } from "@/actions/maintenance-actions";
import type { ActionState } from "@/actions/user-actions";
import { maintenanceStatusLabels, maintenanceTypeOptions } from "@/lib/vehicle-enums";
import { PIECE_CATALOG, PIECE_CATEGORIES, PIECE_CATEGORY_OTRO, accionPiezaOptions } from "@/lib/piece-catalog";
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
      {pending ? "Guardando..." : "Registrar mantenimiento"}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function CreateMaintenanceLogForm({ vehicleId }: { vehicleId: string }) {
  const action = createMaintenanceLog.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const searchParams = useSearchParams();

  // Cuando una pieza de inventario se marca "Utilizada", se redirige aquí
  // con estos datos ya listos (ver actions/inventory-actions.ts) para no
  // tener que volver a escribirlos.
  const prefillPieza = searchParams.get("prefillPieza") ?? "";
  const prefillCantidad = searchParams.get("prefillCantidad") ?? "";
  const prefillUnidad = searchParams.get("prefillUnidad") ?? "";
  // Id de la pieza de inventario que quedó esperando este registro para
  // amarrarse a él (ver vincularPiezaARegistro).
  const vincularPieza = searchParams.get("vincularPieza") ?? "";
  const hasPrefill = Boolean(prefillPieza || prefillCantidad || prefillUnidad);

  // La pieza que llega prellenada desde Inventarios es texto libre (no se
  // sabe su categoría), así que se captura como "Otro" para no perderla.
  const [categoriaPieza, setCategoriaPieza] = useState(prefillPieza ? PIECE_CATEGORY_OTRO : "");

  useEffect(() => {
    if (hasPrefill && detailsRef.current) {
      detailsRef.current.open = true;
    }
  }, [hasPrefill]);

  return (
    <details ref={detailsRef} className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Registrar mantenimiento
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
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-tipoMantenimiento">
              Tipo de mantenimiento
            </label>
            <select
              id="mnt-tipoMantenimiento"
              name="tipoMantenimiento"
              required
              defaultValue=""
              className={inputClass}
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {maintenanceTypeOptions.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {tipo}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-tipoServicio">
              Tipo de servicio
            </label>
            <input id="mnt-tipoServicio" name="tipoServicio" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-fecha">
              Fecha
            </label>
            <input id="mnt-fecha" name="fecha" type="date" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-kilometraje">
              Kilometraje actual
            </label>
            <input
              id="mnt-kilometraje"
              name="kilometraje"
              type="number"
              min={0}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-categoriaPieza">
              Categoría de la pieza
            </label>
            <select
              id="mnt-categoriaPieza"
              name="categoriaPieza"
              value={categoriaPieza}
              onChange={(e) => setCategoriaPieza(e.target.value)}
              className={inputClass}
            >
              <option value="">Sin pieza específica</option>
              {PIECE_CATEGORIES.map((categoria) => (
                <option key={categoria} value={categoria}>
                  {categoria}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-pieza">
              Pieza
            </label>
            {categoriaPieza && categoriaPieza !== PIECE_CATEGORY_OTRO ? (
              <select
                key={categoriaPieza}
                id="mnt-pieza"
                name="pieza"
                defaultValue=""
                className={inputClass}
              >
                <option value="" disabled>
                  Selecciona...
                </option>
                {PIECE_CATALOG[categoriaPieza].map((pieza) => (
                  <option key={pieza} value={pieza}>
                    {pieza}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="mnt-pieza"
                name="pieza"
                placeholder={categoriaPieza === PIECE_CATEGORY_OTRO ? "Escribe la pieza..." : ""}
                disabled={!categoriaPieza}
                defaultValue={prefillPieza}
                className={`${inputClass} disabled:bg-gray-100 disabled:text-gray-400`}
              />
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-accionPieza">
              Acción realizada en la pieza
            </label>
            <select id="mnt-accionPieza" name="accionPieza" defaultValue="" className={inputClass}>
              <option value="">Sin especificar</option>
              {accionPiezaOptions.map((accion) => (
                <option key={accion} value={accion}>
                  {accion}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-cantidad">
              Cantidad
            </label>
            <input
              id="mnt-cantidad"
              name="cantidad"
              defaultValue={prefillCantidad}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-unidad">
              Unidad
            </label>
            <input
              id="mnt-unidad"
              name="unidad"
              defaultValue={prefillUnidad}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-estatus">
              Estatus del proceso
            </label>
            <select id="mnt-estatus" name="estatus" defaultValue="SIN_ATENCION" className={inputClass}>
              {Object.entries(maintenanceStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-nombreOperador">
              Nombre del operador
            </label>
            <input id="mnt-nombreOperador" name="nombreOperador" className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-auxiliarTecnico">
              Auxiliar técnico
            </label>
            <input id="mnt-auxiliarTecnico" name="auxiliarTecnico" className={inputClass} />
          </div>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-ink"
              htmlFor="mnt-responsableTrabajoMecanico"
            >
              Responsable del trabajo mecánico
            </label>
            <input
              id="mnt-responsableTrabajoMecanico"
              name="responsableTrabajoMecanico"
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-descripcion">
            Descripción
          </label>
          <textarea id="mnt-descripcion" name="descripcion" rows={2} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-observacion">
            Observación
          </label>
          <textarea id="mnt-observacion" name="observacion" rows={2} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-files">
            Documentos (PDF o imagen, opcional)
          </label>
          <input
            id="mnt-files"
            name="files"
            type="file"
            accept="application/pdf,image/*"
            multiple
            className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-fotoAntes">
              Foto de antes (opcional)
            </label>
            <input
              id="mnt-fotoAntes"
              name="fotoAntes"
              type="file"
              accept="image/*"
              className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-fotoDespues">
              Foto de después (opcional)
            </label>
            <input
              id="mnt-fotoDespues"
              name="fotoDespues"
              type="file"
              accept="image/*"
              className="w-full text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
            />
          </div>
        </div>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
