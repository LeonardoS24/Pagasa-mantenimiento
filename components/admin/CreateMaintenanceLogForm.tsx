"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import { createMaintenanceLog } from "@/actions/maintenance-actions";
import type { ActionState } from "@/actions/user-actions";
import {
  maintenanceStatusLabels,
  maintenanceTypeOptions,
  calidadMantenimientoOptions,
  calidadMantenimientoLabels,
  type MaintenanceType,
} from "@/lib/vehicle-enums";
import { PIECE_CATALOG, PIECE_CATEGORIES, PIECE_CATEGORY_OTRO, accionPiezaOptions } from "@/lib/piece-catalog";
import { unidadAbreviatura } from "@/lib/inventory-enums";
import {
  PREVENTIVE_CHECKLIST_ITEMS,
  OTHER_CHECKLIST_ITEM,
  checklistEstadoOptions,
  checklistRequiresCantidad,
  checklistCantidadLabel,
  checklistAllowsDescripcion,
  DEFAULT_CHECKLIST_ESTADO,
  type ChecklistEstado,
  type ChecklistEntry,
} from "@/lib/preventive-checklist";
import { FormMessage } from "./FormMessage";

type ChecklistRowState = { estado: ChecklistEstado; cantidad: string; descripcion: string };

function defaultChecklistState(): Record<string, ChecklistRowState> {
  return Object.fromEntries(
    PREVENTIVE_CHECKLIST_ITEMS.map((item) => [
      item,
      { estado: DEFAULT_CHECKLIST_ESTADO, cantidad: "", descripcion: "" },
    ])
  );
}

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

export type InventoryOption = { id: string; nombre: string; cantidad: number; unidad: string };

export function CreateMaintenanceLogForm({
  vehicleId,
  availableInventory = [],
}: {
  vehicleId: string;
  // Piezas EN_INVENTARIO de la ciudad de esta unidad, para elegirlas directo
  // aquí en vez de escribirlas a mano (ver actions/inventory-actions.ts: es
  // la dirección inversa del flujo que marca una pieza "Utilizada" desde
  // Inventarios y prellena este mismo formulario).
  availableInventory?: InventoryOption[];
}) {
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
  // Pieza elegida aquí mismo del inventario disponible (distinta del prefill
  // que llega por URL desde Inventarios): al guardar, esa pieza se marca
  // "Utilizada" y queda ligada a este registro (ver actions/maintenance-actions.ts).
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<InventoryOption | null>(null);
  const [tipo, setTipo] = useState<MaintenanceType | "">("");
  const isPreventivo = tipo === "Preventivo";
  // Checklist de mantenimiento preventivo: se llena solo cuando el tipo es
  // "Preventivo" (ver lib/preventive-checklist.ts). Reemplaza al selector de
  // una sola pieza para ese tipo, no lo complementa.
  const [checklist, setChecklist] = useState<Record<string, ChecklistRowState>>(defaultChecklistState);
  const checklistEntries: ChecklistEntry[] = PREVENTIVE_CHECKLIST_ITEMS.map((item) => {
    const row = checklist[item] ?? { estado: DEFAULT_CHECKLIST_ESTADO, cantidad: "", descripcion: "" };
    return {
      item,
      estado: row.estado,
      ...(checklistRequiresCantidad(row.estado) && row.cantidad.trim() ? { cantidad: row.cantidad.trim() } : {}),
      ...(checklistAllowsDescripcion(row.estado) && row.descripcion.trim()
        ? { descripcion: row.descripcion.trim() }
        : {}),
    };
  });

  useEffect(() => {
    if (hasPrefill && detailsRef.current) {
      detailsRef.current.open = true;
    }
  }, [hasPrefill]);

  // Después de guardar con éxito, el reset() nativo del <form> no alcanza
  // para los campos controlados por estado de React (categoría/pieza y el
  // checklist quedarían mostrando lo último capturado).
  useEffect(() => {
    if (state.success) {
      setCategoriaPieza(prefillPieza ? PIECE_CATEGORY_OTRO : "");
      setSelectedInventoryItem(null);
      setTipo("");
      setChecklist(defaultChecklistState());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

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
              value={tipo}
              onChange={(e) => setTipo(e.target.value as MaintenanceType)}
              className={inputClass}
            >
              <option value="" disabled>
                Selecciona...
              </option>
              {maintenanceTypeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
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
              required
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-calidad">
              Calidad general de la unidad
            </label>
            <select id="mnt-calidad" name="calidad" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Selecciona...
              </option>
              {calidadMantenimientoOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {calidadMantenimientoLabels[opt]}
                </option>
              ))}
            </select>
          </div>
          {!isPreventivo && availableInventory.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-piezaInventario">
                Pieza de inventario (opcional)
              </label>
              <select
                id="mnt-piezaInventario"
                value={selectedInventoryItem?.id ?? ""}
                onChange={(e) => {
                  const item = availableInventory.find((i) => i.id === e.target.value) ?? null;
                  setSelectedInventoryItem(item);
                  if (item) setCategoriaPieza(PIECE_CATEGORY_OTRO);
                }}
                className={inputClass}
              >
                <option value="">Escribir la pieza a mano</option>
                {availableInventory.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre} — {item.cantidad} {unidadAbreviatura(item.unidad)}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Al elegir una pieza de aquí, se marca como &quot;Utilizada&quot; y queda ligada a este
                registro.
              </p>
            </div>
          )}
          {!isPreventivo && (
            <>
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
                    key={selectedInventoryItem?.id ?? "manual"}
                    id="mnt-pieza"
                    name="pieza"
                    placeholder={categoriaPieza === PIECE_CATEGORY_OTRO ? "Escribe la pieza..." : ""}
                    disabled={!categoriaPieza}
                    defaultValue={selectedInventoryItem ? selectedInventoryItem.nombre : prefillPieza}
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
            </>
          )}
          {!isPreventivo && (
            <>
              {selectedInventoryItem && (
                <input type="hidden" name="piezaInventarioId" value={selectedInventoryItem.id} />
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-cantidad">
                  Cantidad
                </label>
                <input
                  key={selectedInventoryItem?.id ?? "manual"}
                  id="mnt-cantidad"
                  name="cantidad"
                  defaultValue={
                    selectedInventoryItem ? String(selectedInventoryItem.cantidad) : prefillCantidad
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="mnt-unidad">
                  Unidad
                </label>
                <input
                  key={selectedInventoryItem?.id ?? "manual"}
                  id="mnt-unidad"
                  name="unidad"
                  defaultValue={
                    selectedInventoryItem ? unidadAbreviatura(selectedInventoryItem.unidad) : prefillUnidad
                  }
                  className={inputClass}
                />
              </div>
            </>
          )}
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

        {isPreventivo && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <input type="hidden" name="checklistPreventivo" value={JSON.stringify(checklistEntries)} readOnly />
            <p className="mb-2 text-sm font-medium text-ink">
              Checklist de mantenimiento preventivo
            </p>
            <p className="mb-3 text-xs text-gray-500">
              Marca el estado de cada pieza. Buen estado no se documenta; Relleno,
              Lubricación y Cambio sí quedan documentados cada uno como su propio
              registro. Relleno pide la cantidad rellenada y Cambio el número de
              piezas; cualquiera de los tres admite una descripción opcional. Usa
              &quot;Otro&quot; para lo que no esté en la lista (en el gráfico se agrupa
              como &quot;Otro&quot;, sin importar lo que escribas).
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {PREVENTIVE_CHECKLIST_ITEMS.map((item) => {
                const row = checklist[item] ?? { estado: DEFAULT_CHECKLIST_ESTADO, cantidad: "", descripcion: "" };
                const needsCantidad = checklistRequiresCantidad(row.estado);
                const allowsDescripcion = checklistAllowsDescripcion(row.estado);
                return (
                  <div key={item} className="rounded-md bg-white px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-ink">{item}</span>
                      <select
                        value={row.estado}
                        onChange={(e) =>
                          setChecklist((prev) => ({
                            ...prev,
                            [item]: { estado: e.target.value as ChecklistEstado, cantidad: "", descripcion: "" },
                          }))
                        }
                        className="rounded-md border border-gray-300 px-1.5 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      >
                        {checklistEstadoOptions.map((estado) => (
                          <option key={estado} value={estado}>
                            {estado}
                          </option>
                        ))}
                      </select>
                    </div>
                    {needsCantidad && (
                      <input
                        type={row.estado === "Cambio" ? "number" : "text"}
                        min={row.estado === "Cambio" ? 1 : undefined}
                        placeholder={checklistCantidadLabel(row.estado)}
                        value={row.cantidad}
                        onChange={(e) =>
                          setChecklist((prev) => ({
                            ...prev,
                            [item]: { ...row, cantidad: e.target.value },
                          }))
                        }
                        className="mt-1.5 w-full rounded-md border border-gray-300 px-1.5 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    )}
                    {allowsDescripcion && (
                      <input
                        type="text"
                        placeholder={
                          item === OTHER_CHECKLIST_ITEM ? "¿Qué pieza es y qué se hizo?" : "Descripción (opcional)"
                        }
                        value={row.descripcion}
                        onChange={(e) =>
                          setChecklist((prev) => ({
                            ...prev,
                            [item]: { ...row, descripcion: e.target.value },
                          }))
                        }
                        className="mt-1.5 w-full rounded-md border border-gray-300 px-1.5 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
