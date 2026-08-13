"use client";

import { useEffect, useRef, useState } from "react";
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

export function CreateValveChangeLogForm({
  vehicleId,
  sectionSlug,
  hasPriorValveLog,
  knownTieneValvula85,
}: {
  vehicleId: string;
  // Vehículo con tanque de carburación solo tiene 4 de las 9 válvulas (ver
  // lib/piece-catalog.ts y actions/valve-actions.ts: requireValvulasCompletas).
  sectionSlug: string;
  // Si ya existe al menos un registro de cambio de válvulas para esta
  // unidad, ya se sabe si tiene o no la válvula de máximo llenado al 85%
  // (createValveChangeLog sincroniza tieneValvulaMaximoLlenado85 a la ficha
  // técnica en cada registro): ya no hace falta volver a preguntar, solo
  // pedir la fecha de fabricación de la nueva válvula cuando sí aplica.
  hasPriorValveLog: boolean;
  knownTieneValvula85: boolean;
}) {
  const isCarburacion = sectionSlug === "vehiculo-con-tanque-de-carburacion";
  const action = createValveChangeLog.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const searchParams = useSearchParams();
  const yaSePregunto = !isCarburacion && hasPriorValveLog;
  const [tieneValvula85, setTieneValvula85] = useState(yaSePregunto && knownTieneValvula85);

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
          setTieneValvula85(yaSePregunto && knownTieneValvula85);
        }}
        className="mt-4 space-y-3"
      >
        {vincularPieza && <input type="hidden" name="vincularPieza" value={vincularPieza} />}
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="valv-responsable">
            Responsable
          </label>
          <input id="valv-responsable" name="responsable" className={`max-w-xs ${inputClass}`} />
        </div>

        <div className="max-w-xs rounded-md border-2 border-primary/40 bg-primary/5 p-3">
          <label
            className="mb-1 block text-sm font-medium text-ink"
            htmlFor="valv-fechaInstalacion"
          >
            Fecha de instalación del juego de válvulas
          </label>
          <input
            id="valv-fechaInstalacion"
            name="fechaInstalacion"
            type="date"
            required
            className={inputClass}
          />
        </div>

        <p className="text-xs font-semibold uppercase text-gray-500">
          Fecha de fabricación de cada válvula
        </p>
        {isCarburacion ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label
                className="mb-1 block text-sm font-medium text-ink"
                htmlFor="valv-fechaFabricacionValvulaLlenado"
              >
                Válvula de llenado (Doble check)
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
                htmlFor="valv-fechaFabricacionValvulaMaximoLlenado"
              >
                Válvula de máximo llenado (purgador)
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
                htmlFor="valv-fechaFabricacionValvulaServicio"
              >
                Válvula de servicio (reguladora)
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
                htmlFor="valv-fechaFabricacionValvulaAlivio"
              >
                Válvula de seguridad
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
        ) : (
          <>
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
                  htmlFor="valv-fechaFabricacionValvulaNoRetroceso"
                >
                  Válvula de no retroceso (check)
                </label>
                <input
                  id="valv-fechaFabricacionValvulaNoRetroceso"
                  name="fechaFabricacionValvulaNoRetroceso"
                  type="date"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-ink"
                  htmlFor="valv-fechaFabricacionValvulaBypass"
                >
                  Válvula de retroceso (bypass)
                </label>
                <input
                  id="valv-fechaFabricacionValvulaBypass"
                  name="fechaFabricacionValvulaBypass"
                  type="date"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-ink"
                  htmlFor="valv-fechaFabricacionValvulaRetornoVapores"
                >
                  Válvula de retorno de vapores
                </label>
                <input
                  id="valv-fechaFabricacionValvulaRetornoVapores"
                  name="fechaFabricacionValvulaRetornoVapores"
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
                  Válvula de servicio de vapor
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
                  Válvula de máximo llenado 90%
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
                  Válvula de seguridad
                </label>
                <input
                  id="valv-fechaFabricacionValvulaAlivio"
                  name="fechaFabricacionValvulaAlivio"
                  type="date"
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label
                  className="mb-1 block text-sm font-medium text-ink"
                  htmlFor="valv-fechaFabricacionValvulaDescargaEmergencia"
                >
                  Válvula de descarga de emergencia
                </label>
                <input
                  id="valv-fechaFabricacionValvulaDescargaEmergencia"
                  name="fechaFabricacionValvulaDescargaEmergencia"
                  type="date"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <div className="rounded-md border border-dashed border-gray-300 p-3">
              {yaSePregunto ? (
                // Ya se sabe la respuesta de un registro anterior de esta
                // misma unidad: no se vuelve a preguntar, solo se pide (si
                // aplica) la fecha de fabricación de la válvula nueva.
                <>
                  <p className="text-sm text-ink">
                    {knownTieneValvula85
                      ? "Esta unidad tiene válvula de máximo llenado al 85%."
                      : "Esta unidad no tiene válvula de máximo llenado al 85%."}
                  </p>
                  {knownTieneValvula85 && (
                    <>
                      <input type="hidden" name="tieneValvulaMaximoLlenado85" value="on" />
                      <div className="mt-3 max-w-xs">
                        <label
                          className="mb-1 block text-sm font-medium text-ink"
                          htmlFor="valv-fechaFabricacionValvulaMaximoLlenado85"
                        >
                          Fecha de fabricación de la válvula de máximo llenado 85%
                        </label>
                        <input
                          id="valv-fechaFabricacionValvulaMaximoLlenado85"
                          name="fechaFabricacionValvulaMaximoLlenado85"
                          type="date"
                          required
                          className={inputClass}
                        />
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm font-medium text-ink" htmlFor="valv-tieneValvulaMaximoLlenado85">
                    <input
                      id="valv-tieneValvulaMaximoLlenado85"
                      name="tieneValvulaMaximoLlenado85"
                      type="checkbox"
                      checked={tieneValvula85}
                      onChange={(event) => setTieneValvula85(event.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
                    />
                    ¿Esta unidad tiene válvula de máximo llenado al 85%?
                  </label>
                  {tieneValvula85 && (
                    <div className="mt-3 max-w-xs">
                      <label
                        className="mb-1 block text-sm font-medium text-ink"
                        htmlFor="valv-fechaFabricacionValvulaMaximoLlenado85"
                      >
                        Fecha de fabricación de la válvula de máximo llenado 85%
                      </label>
                      <input
                        id="valv-fechaFabricacionValvulaMaximoLlenado85"
                        name="fechaFabricacionValvulaMaximoLlenado85"
                        type="date"
                        required
                        className={inputClass}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

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
          Al aceptar, la ficha técnica actualizará automáticamente todo el juego de fechas de
          fabricación y la fecha de instalación. El aviso de cambio se calcula sobre la válvula
          con la fecha de fabricación más antigua: vence a los 5 años.
        </p>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </details>
  );
}
