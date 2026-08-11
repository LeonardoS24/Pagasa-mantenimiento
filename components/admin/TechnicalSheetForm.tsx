"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { VehicleTechnicalSheet } from "@prisma/client";
import { upsertTechnicalSheet } from "@/actions/vehicle-actions";
import type { ActionState } from "@/actions/user-actions";
import { combustibleLabels, calidadExtintorLabels } from "@/lib/vehicle-enums";
import { toDateInputValue, formatDate } from "@/lib/dates";
import { getExtinguisherAlertLevel, extinguisherAlertBadgeStyles, extinguisherAlertLabel } from "@/lib/extinguisher-alerts";
import {
  getMaintenanceAlertLevel,
  maintenanceAlertBadgeStyles,
  maintenanceAlertLabel,
} from "@/lib/maintenance-alerts";
import { getValveAlertLevel, getValveVencimiento, valveAlertBadgeStyles, valveAlertLabel } from "@/lib/valve-alerts";
import { getHoseAlertLevel, getHoseVencimiento, hoseAlertBadgeStyles, hoseAlertLabel } from "@/lib/hose-alerts";
import { FormMessage } from "./FormMessage";
import { SECTION_STYLES } from "@/lib/section-colors";
import { isAlertVisibleForSection } from "@/lib/alert-visibility";

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
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Guardar ficha técnica"}
    </button>
  );
}

export function TechnicalSheetForm({
  vehicleId,
  sheet,
  sectionSlug,
  useDeliveryFormat = false,
  showValveSection = false,
  showHoseSection = false,
  showTankSection = true,
  showInspeccionesSection = true,
  showMaintenancePreventiveSection = true,
  showAutomovilSection = true,
  lockCombustibleGasLpGasolina = false,
}: {
  vehicleId: string;
  sheet: VehicleTechnicalSheet | null;
  // Para no repetir la alerta de extintor/mantenimiento preventivo cuando la
  // misma unidad vive también en Vehículo con tanque de carburación (ver
  // lib/alert-visibility.ts).
  sectionSlug: string;
  // Formato para Vehículo de reparto y Vehículo con tanque de carburación:
  // "Peso" se reemplaza por dos pesos brutos y "Tanque" pasa a llamarse
  // "Tanque de carburación".
  useDeliveryFormat?: boolean;
  // Solo Vehículo con tanque de carburación (no Vehículo de reparto, aunque
  // comparta useDeliveryFormat).
  showValveSection?: boolean;
  // Solo Vehículo con tanque de carburación.
  showHoseSection?: boolean;
  // false solo para Vehículo de reparto: no tiene tanque, así que no aplica
  // ninguna ficha técnica de tanque.
  showTankSection?: boolean;
  // false solo para Vehículo de reparto: sus 5 pruebas de tanque (Visual
  // Externa, Hermeticidad, Visual Interna, Ultrasonido, Hidrostática) viven
  // en Auto-Tanques y en Vehículo con tanque de carburación, no aquí.
  showInspeccionesSection?: boolean;
  // false solo para Vehículo con tanque de carburación: cuando la unidad se
  // repite en Auto-Tanques, el mantenimiento preventivo se lleva desde ahí
  // para no duplicarlo (ver también lib/alert-visibility.ts).
  showMaintenancePreventiveSection?: boolean;
  // false solo para Estaciones de carburación (ver
  // scripts/add-estaciones-de-carburacion.mjs): no es un vehículo, su
  // identidad ya es "Nombre"/"Dirección" (ver VehicleForm.tsx), así que esta
  // sección de datos del automóvil no aplica.
  showAutomovilSection?: boolean;
  // Vehículo con tanque de carburación, y Auto-Tanques cuyo número
  // económico se repite en Vehículo con tanque de carburación (misma
  // ciudad), siempre usan Gas LP/Gasolina: el select queda visible pero el
  // valor se fuerza en el servidor (ver actions/vehicle-actions.ts) sin
  // importar lo que se elija aquí.
  lockCombustibleGasLpGasolina?: boolean;
}) {
  const action = upsertTechnicalSheet.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  // Bloqueada por default: sin esto, cualquiera que entre a la ficha técnica
  // puede cambiar o borrar un valor sin querer con solo dar clic. Hay que
  // apretar "Editar" para poder tocar los campos.
  const [locked, setLocked] = useState(true);
  const [tieneValvula85, setTieneValvula85] = useState(sheet?.tieneValvulaMaximoLlenado85 ?? false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCancel() {
    formRef.current?.reset();
    setLocked(true);
    setTieneValvula85(sheet?.tieneValvulaMaximoLlenado85 ?? false);
  }
  const extinguisherAlertLevel = getExtinguisherAlertLevel(
    sheet?.calidadExtintor,
    sheet?.fechaCalidadMalaExtintor
  );
  const maintenanceAlertLevel = getMaintenanceAlertLevel(sheet?.fechaProximoMantenimiento);
  const valveDatesForAlert = {
    fechaFabricacionValvulaLlenado: sheet?.fechaFabricacionValvulaLlenado,
    fechaFabricacionValvulaNoRetroceso: sheet?.fechaFabricacionValvulaNoRetroceso,
    fechaFabricacionValvulaBypass: sheet?.fechaFabricacionValvulaBypass,
    fechaFabricacionValvulaRetornoVapores: sheet?.fechaFabricacionValvulaRetornoVapores,
    fechaFabricacionValvulaServicio: sheet?.fechaFabricacionValvulaServicio,
    fechaFabricacionValvulaMaximoLlenado: sheet?.fechaFabricacionValvulaMaximoLlenado,
    fechaFabricacionValvulaMaximoLlenado85: sheet?.fechaFabricacionValvulaMaximoLlenado85,
    fechaFabricacionValvulaAlivio: sheet?.fechaFabricacionValvulaAlivio,
    fechaFabricacionValvulaDescargaEmergencia: sheet?.fechaFabricacionValvulaDescargaEmergencia,
  };
  const valveAlertLevel = getValveAlertLevel(valveDatesForAlert);
  const valveVencimiento = getValveVencimiento(valveDatesForAlert);
  const hoseAlertLevel = getHoseAlertLevel(sheet?.fechaFabricacionManguera);
  const hoseVencimiento = getHoseVencimiento(sheet?.fechaFabricacionManguera);

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-2">
        <p className="text-sm text-ink">
          {locked
            ? "La ficha técnica está bloqueada para evitar cambios por accidente."
            : "Editando la ficha técnica."}
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

      <fieldset disabled={locked} className="space-y-6">
      {showAutomovilSection && (
      <div className={`rounded-md p-4 ${SECTION_STYLES.automovil}`}>
        <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
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
              defaultValue={lockCombustibleGasLpGasolina ? "GAS_LP_GASOLINA" : sheet?.combustible ?? ""}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="">Selecciona...</option>
              {Object.entries(combustibleLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {lockCombustibleGasLpGasolina && (
              <p className="mt-1 text-xs text-gray-500">
                Fijo en Gas LP/Gasolina (Vehículo con tanque de carburación o mismo número
                económico repetido ahí).
              </p>
            )}
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
      )}

      {showTankSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.tanque}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
            {useDeliveryFormat ? "Tanque de carburación" : "Tanque"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              id="numeroSerieTanque"
              label="Número de serie"
              defaultValue={sheet?.numeroSerieTanque}
            />
            <Field id="capacidadTanque" label="Capacidad (Lts)" defaultValue={sheet?.capacidadTanque} />
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
          </div>
        </div>
      )}

      {showMaintenancePreventiveSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.mantenimiento}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold uppercase text-primary-bright">
              Mantenimiento preventivo
            </h3>
            {maintenanceAlertLevel !== "none" &&
              sheet?.fechaProximoMantenimiento &&
              isAlertVisibleForSection("mantenimiento", sectionSlug) && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${maintenanceAlertBadgeStyles[maintenanceAlertLevel]}`}
              >
                {maintenanceAlertLabel(
                  maintenanceAlertLevel,
                  sheet.fechaProximoMantenimiento,
                  sheet.kilometrajeProximoMantenimiento
                )}
              </span>
            )}
          </div>
          {/* El kilometraje se actualiza con cualquier tipo de mantenimiento
              (es solo el odómetro); la fecha del preventivo y su próxima
              fecha/kilometraje solo se mueven con un mantenimiento tipo
              "Preventivo" (ver actions/maintenance-actions.ts), así que se
              muestran por separado: uno puede estar sin el otro. */}
          {sheet?.kilometrajeUltimoMantenimiento != null && (
            <p className="text-sm text-ink">
              Kilometraje actual: {sheet.kilometrajeUltimoMantenimiento.toLocaleString("es-MX")} km
            </p>
          )}
          {sheet?.fechaUltimoMantenimiento ? (
            <p className="text-sm text-ink">
              Último mantenimiento preventivo: {formatDate(sheet.fechaUltimoMantenimiento)}. Próximo:{" "}
              {sheet.fechaProximoMantenimiento && formatDate(sheet.fechaProximoMantenimiento)}
              {sheet.kilometrajeProximoMantenimiento != null &&
                ` o a los ${sheet.kilometrajeProximoMantenimiento.toLocaleString("es-MX")} km`}
              , lo que se cumpla primero.
            </p>
          ) : (
            <p className="text-sm text-ink">
              Sin mantenimiento preventivo registrado todavía. Se calcula al capturar un
              mantenimiento tipo &quot;Preventivo&quot; (ver Bitácora de mantenimiento).
            </p>
          )}
        </div>
      )}

      <div className={`rounded-md p-4 ${SECTION_STYLES.extintor}`}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold uppercase text-primary-bright">Extintor</h3>
          {extinguisherAlertLevel !== "none" && isAlertVisibleForSection("extintor", sectionSlug) && (
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
          Cuando la calidad se marca como “Mala” se genera una alerta para reemplazar el
          extintor: amarilla los primeros 2 días, roja a partir del día 2.
        </p>
      </div>

      {showHoseSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.mangueras}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold uppercase text-primary-bright">
              Cambio de mangueras
            </h3>
            {hoseAlertLevel !== "none" && hoseVencimiento && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${hoseAlertBadgeStyles[hoseAlertLevel]}`}
              >
                {hoseAlertLabel(hoseAlertLevel, hoseVencimiento)}
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              id="fechaInstalacionMangueras"
              label="Fecha de instalación"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaInstalacionMangueras)}
            />
            <Field
              id="fechaFabricacionManguera"
              label="Fecha de fabricación de la manguera"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaFabricacionManguera)}
            />
          </div>
          <p className="mt-2 text-xs text-ink">
            El cambio de mangueras debe hacerse cada 2 años a partir de la fecha de fabricación.
          </p>
        </div>
      )}

      {showValveSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.valvulas}`}>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold uppercase text-primary-bright">
              Cambio de válvulas
            </h3>
            {valveAlertLevel !== "none" && valveVencimiento && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${valveAlertBadgeStyles[valveAlertLevel]}`}
              >
                {valveAlertLabel(valveAlertLevel, valveVencimiento)}
              </span>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              id="fechaInstalacionValvulas"
              label="Fecha de instalación"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaInstalacionValvulas)}
            />
            <Field
              id="fechaFabricacionValvulaLlenado"
              label="Válvula de llenado"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaFabricacionValvulaLlenado)}
            />
            <Field
              id="fechaFabricacionValvulaNoRetroceso"
              label="Válvula de no retroceso (check)"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaFabricacionValvulaNoRetroceso)}
            />
            <Field
              id="fechaFabricacionValvulaBypass"
              label="Válvula de retroceso (bypass)"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaFabricacionValvulaBypass)}
            />
            <Field
              id="fechaFabricacionValvulaRetornoVapores"
              label="Válvula de retorno de vapores"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaFabricacionValvulaRetornoVapores)}
            />
            <Field
              id="fechaFabricacionValvulaServicio"
              label="Válvula de servicio de vapor"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaFabricacionValvulaServicio)}
            />
            <Field
              id="fechaFabricacionValvulaMaximoLlenado"
              label="Válvula de máximo llenado 90%"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaFabricacionValvulaMaximoLlenado)}
            />
            <Field
              id="fechaFabricacionValvulaAlivio"
              label="Válvula de seguridad"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaFabricacionValvulaAlivio)}
            />
            <Field
              id="fechaFabricacionValvulaDescargaEmergencia"
              label="Válvula de descarga de emergencia"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaFabricacionValvulaDescargaEmergencia)}
            />
          </div>
          <div className="mt-3 rounded-md border border-dashed border-gray-300 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-ink" htmlFor="tieneValvulaMaximoLlenado85">
              <input
                id="tieneValvulaMaximoLlenado85"
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
                <Field
                  id="fechaFabricacionValvulaMaximoLlenado85"
                  label="Fecha de fabricación de la válvula de máximo llenado 85%"
                  type="date"
                  defaultValue={toDateInputValue(sheet?.fechaFabricacionValvulaMaximoLlenado85)}
                />
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-ink">
            El cambio de válvulas debe hacerse cada 5 años. El aviso se calcula sobre la fecha de
            fabricación más antigua de todo el juego.
          </p>
        </div>
      )}

      {showInspeccionesSection && (
      <>
      <div className={`rounded-md p-4 ${SECTION_STYLES.visualExterna}`}>
        <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
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
            defaultValue={toDateInputValue(sheet?.fechaProximaInspeccionVisual)}
          />
        </div>
        <p className="mt-2 text-xs text-ink">
          Cuando falte un mes para la fecha próxima de inspección visual externa, la unidad se
          marcará en amarillo; cuando falte una semana, se marcará en rojo con advertencias en el
          panel de alertas del inicio.
        </p>
      </div>

      <div className={`rounded-md p-4 ${SECTION_STYLES.hermeticidad}`}>
        <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
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
            defaultValue={toDateInputValue(sheet?.fechaProximaPruebaHermeticidad)}
          />
        </div>
        <p className="mt-2 text-xs text-ink">
          Se revisa típicamente cada año. Cuando falte un mes para la fecha próxima, la unidad se
          marcará en amarillo; cuando falte una semana, se marcará en rojo con advertencias en el
          panel de alertas del inicio.
        </p>
      </div>

      <div className={`rounded-md p-4 ${SECTION_STYLES.visualInterna}`}>
        <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
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

      <div className={`rounded-md p-4 ${SECTION_STYLES.ultrasonido}`}>
        <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
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
            defaultValue={toDateInputValue(sheet?.fechaProximoUltrasonido)}
          />
        </div>
        <p className="mt-2 text-xs text-ink">
          Cuando falte un mes para la fecha próxima de ultrasonido, la unidad se marcará en
          amarillo; cuando falte una semana, se marcará en rojo con advertencias en el panel de
          alertas del inicio.
        </p>
      </div>

      <div className={`rounded-md p-4 ${SECTION_STYLES.hidrostatica}`}>
        <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
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
      </>
      )}
      </fieldset>

      <FormMessage state={state} />

      {!locked && <SubmitButton />}
    </form>
  );
}
