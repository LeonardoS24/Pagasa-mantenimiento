"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/user-actions";
import { tipoEquipoSchema, tipoEquipoLabels, estadoEquipoSchema, estadoEquipoLabels, criticidadEquipoSchema, criticidadEquipoLabels } from "@/lib/equipo-enums";
import { SECTION_STYLES, equipoColorKey } from "@/lib/section-colors";
import { PLANT_AREA_NAMES } from "@/lib/plant-areas";
import { toDateInputValue } from "@/lib/dates";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

type EquipoFormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export interface EquipoFormDefaults {
  tipoEquipo?: string;
  codigo?: string | null;
  nombre?: string;
  categoria?: string | null;
  tipoEquipoDetalle?: string | null;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  fabricante?: string | null;
  anioFabricacion?: string | null;
  fechaInstalacion?: Date | null;
  ubicacion?: string | null;
  responsable?: string | null;
  estado?: string | null;
  criticidad?: string | null;
  frecuenciaMantenimiento?: string | null;
  observaciones?: string | null;
  capacidad?: string | null;
  presionTrabajo?: string | null;
  temperaturaOperacion?: string | null;
  materialFabricacion?: string | null;
  fluidoTrabajo?: string | null;
  potencia?: string | null;
  rpm?: string | null;
  lubricante?: string | null;
  voltaje?: string | null;
  corriente?: string | null;
  frecuenciaElectrica?: string | null;
  numeroFases?: string | null;
  proteccionIp?: string | null;
  claseAislamiento?: string | null;
  consumoElectrico?: string | null;
  comunicacion?: string | null;
  combustible?: string | null;
  horasOperacion?: string | null;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function Field({
  label,
  name,
  defaultValue,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-ink" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        className={inputClass}
      />
    </div>
  );
}

export function EquipoForm({
  action,
  defaults,
  submitLabel,
  allowFiles = false,
  isPlanta = false,
}: {
  action: EquipoFormAction;
  defaults?: EquipoFormDefaults;
  submitLabel: string;
  allowFiles?: boolean;
  // "Equipos de planta" (ver Section "equipos" anidada en "planta"): la
  // ubicación se elige de las 15 áreas fijas de la planta (ver
  // lib/plant-areas.ts) en vez de escribirse libre, como en el resto de los
  // equipos (estaciones, etc.).
  isPlanta?: boolean;
}) {
  const [state, formAction] = useFormState(action, initialState);
  const [tipoEquipo, setTipoEquipo] = useState(defaults?.tipoEquipo ?? "MECANICO");
  // Ubicación ya capturada que no es ninguna de las 15 áreas oficiales (ver
  // el selector más abajo).
  const ubicacionFueraDeLista =
    isPlanta && !!defaults?.ubicacion && !PLANT_AREA_NAMES.includes(defaults.ubicacion);

  return (
    <form action={formAction} className="space-y-5">
      <div className={`rounded-md p-4 ${SECTION_STYLES[equipoColorKey(tipoEquipo)]}`}>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="tipoEquipo">
          Tipo de equipo
        </label>
        <select
          id="tipoEquipo"
          name="tipoEquipo"
          value={tipoEquipo}
          onChange={(e) => setTipoEquipo(e.target.value)}
          className={inputClass}
        >
          {tipoEquipoSchema.options.map((opt) => (
            <option key={opt} value={opt}>
              {tipoEquipoLabels[opt]}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Código del equipo" name="codigo" defaultValue={defaults?.codigo} />
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="nombre">
            Nombre del equipo
          </label>
          <input
            id="nombre"
            name="nombre"
            defaultValue={defaults?.nombre}
            required
            className={inputClass}
          />
        </div>
        <Field label="Categoría" name="categoria" defaultValue={defaults?.categoria} />
        <Field label="Tipo de equipo (detalle)" name="tipoEquipoDetalle" defaultValue={defaults?.tipoEquipoDetalle} />
        <Field label="Marca" name="marca" defaultValue={defaults?.marca} />
        <Field label="Modelo" name="modelo" defaultValue={defaults?.modelo} />
        <Field label="Número de serie" name="numeroSerie" defaultValue={defaults?.numeroSerie} />
        <Field label="Fabricante" name="fabricante" defaultValue={defaults?.fabricante} />
        <Field label="Año de fabricación" name="anioFabricacion" defaultValue={defaults?.anioFabricacion} />
        <Field
          label="Fecha de instalación"
          name="fechaInstalacion"
          type="date"
          defaultValue={toDateInputValue(defaults?.fechaInstalacion)}
        />
        {isPlanta ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="ubicacion">
              Ubicación
            </label>
            <select id="ubicacion" name="ubicacion" defaultValue={defaults?.ubicacion ?? ""} className={inputClass}>
              <option value="">— Sin especificar —</option>
              {/* La ubicación que ya estaba capturada a mano casi nunca está
                  escrita igual que el área oficial ("Muelle de llenado de
                  cilindros" en vez del nombre largo del reglamento). Sin esta
                  opción, el selector la mostraría en blanco y al guardar se
                  perdería el dato: aquí se conserva y se invita a cambiarla
                  por el área que le toca. */}
              {ubicacionFueraDeLista && (
                <option value={defaults!.ubicacion!}>
                  {defaults!.ubicacion} — capturada antes; elige el área que le corresponde
                </option>
              )}
              {PLANT_AREA_NAMES.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <Field label="Ubicación" name="ubicacion" defaultValue={defaults?.ubicacion} />
        )}
        <Field label="Responsable" name="responsable" defaultValue={defaults?.responsable} />
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="estado">
            Estado
          </label>
          <select id="estado" name="estado" defaultValue={defaults?.estado ?? ""} className={inputClass}>
            <option value="">— Sin especificar —</option>
            {estadoEquipoSchema.options.map((opt) => (
              <option key={opt} value={opt}>
                {estadoEquipoLabels[opt]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="criticidad">
            Criticidad
          </label>
          <select id="criticidad" name="criticidad" defaultValue={defaults?.criticidad ?? ""} className={inputClass}>
            <option value="">— Sin especificar —</option>
            {criticidadEquipoSchema.options.map((opt) => (
              <option key={opt} value={opt}>
                {criticidadEquipoLabels[opt]}
              </option>
            ))}
          </select>
        </div>
        <Field label="Capacidad" name="capacidad" defaultValue={defaults?.capacidad} />
        <Field label="Potencia (si aplica)" name="potencia" defaultValue={defaults?.potencia} />
        <Field
          label="Frecuencia de mantenimiento"
          name="frecuenciaMantenimiento"
          defaultValue={defaults?.frecuenciaMantenimiento}
        />
      </div>

      {tipoEquipo === "MECANICO" && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.equipoMecanico}`}>
          <h3 className="mb-3 text-sm font-semibold text-primary">Datos del equipo mecánico</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Presión de trabajo (MPa o psi)" name="presionTrabajo" defaultValue={defaults?.presionTrabajo} />
            <Field label="Temperatura de operación (°C)" name="temperaturaOperacion" defaultValue={defaults?.temperaturaOperacion} />
            <Field label="Material de fabricación" name="materialFabricacion" defaultValue={defaults?.materialFabricacion} />
            <Field label="Fluido de trabajo" name="fluidoTrabajo" defaultValue={defaults?.fluidoTrabajo} />
            <Field label="RPM (si aplica)" name="rpm" defaultValue={defaults?.rpm} />
            <Field label="Lubricante utilizado" name="lubricante" defaultValue={defaults?.lubricante} />
          </div>
        </div>
      )}

      {tipoEquipo === "ELECTRICO" && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.equipoElectrico}`}>
          <h3 className="mb-3 text-sm font-semibold text-primary">Datos del equipo eléctrico / electrónico</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Voltaje (V)" name="voltaje" defaultValue={defaults?.voltaje} />
            <Field label="Corriente (A)" name="corriente" defaultValue={defaults?.corriente} />
            <Field label="Frecuencia (Hz)" name="frecuenciaElectrica" defaultValue={defaults?.frecuenciaElectrica} />
            <Field label="Número de fases (1Ø/3Ø)" name="numeroFases" defaultValue={defaults?.numeroFases} />
            <Field label="Protección IP (IP65/IP66/etc)" name="proteccionIp" defaultValue={defaults?.proteccionIp} />
            <Field label="Clase de aislamiento (F/H/etc)" name="claseAislamiento" defaultValue={defaults?.claseAislamiento} />
            <Field label="Consumo eléctrico (kWh)" name="consumoElectrico" defaultValue={defaults?.consumoElectrico} />
            <Field label="Comunicación (Modbus/Ethernet/Profibus)" name="comunicacion" defaultValue={defaults?.comunicacion} />
          </div>
        </div>
      )}

      {tipoEquipo === "AUXILIAR" && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.equipoAuxiliar}`}>
          <h3 className="mb-3 text-sm font-semibold text-primary">Datos del equipo auxiliar</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Combustible (Diésel/gasolina/eléctrico)" name="combustible" defaultValue={defaults?.combustible} />
            <Field label="Horas de operación (Horómetro)" name="horasOperacion" defaultValue={defaults?.horasOperacion} />
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="observaciones">
          Observaciones
        </label>
        <textarea
          id="observaciones"
          name="observaciones"
          defaultValue={defaults?.observaciones ?? ""}
          rows={3}
          className={inputClass}
        />
      </div>

      {allowFiles && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="manualTecnico">
              Manual técnico (PDF, opcional, puedes elegir varios)
            </label>
            <input
              id="manualTecnico"
              name="manualTecnico"
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="fotografias">
              Fotografías (opcional, puedes elegir varias)
            </label>
            <input
              id="fotografias"
              name="fotografias"
              type="file"
              accept="image/*"
              multiple
              className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
            />
          </div>
        </div>
      )}

      <FormMessage state={state} />

      <SubmitButton label={submitLabel} />
    </form>
  );
}
