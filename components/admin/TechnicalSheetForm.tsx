"use client";

import { useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { VehicleTechnicalSheet } from "@prisma/client";
import { upsertTechnicalSheet, updateCalidadExtintor } from "@/actions/vehicle-actions";
import type { ActionState } from "@/actions/user-actions";
import { combustibleLabels, calidadExtintorLabels } from "@/lib/vehicle-enums";
import { toDateInputValue, formatDate } from "@/lib/dates";
import { getExtinguisherAlertLevel, extinguisherAlertBadgeStyles, extinguisherAlertLabel } from "@/lib/extinguisher-alerts";
import {
  getMaintenanceAlertLevel,
  maintenanceAlertBadgeStyles,
  maintenanceAlertLabel,
} from "@/lib/maintenance-alerts";
import {
  aniosVigenciaValvulas,
  getValveAlertLevel,
  getValveVencimiento,
  valveAlertBadgeStyles,
  valveAlertLabel,
  valveDatesFromSheet,
} from "@/lib/valve-alerts";
import {
  VALVULAS_TANQUE_CARGA,
  VALVULAS_CARBURACION,
  VALVULA_MAXIMO_LLENADO_85,
  CAMPOS_TRACTOCAMION,
  CAMPOS_SEMIRREMOLQUE,
  type ValvulaDef,
  type CampoTextoDef,
} from "@/lib/ficha-campos";
import { getHoseAlertLevel, getHoseVencimiento, hoseAlertBadgeStyles, hoseAlertLabel } from "@/lib/hose-alerts";
import { FormMessage } from "./FormMessage";
import { SECTION_STYLES } from "@/lib/section-colors";
import { isAlertVisibleForSection } from "@/lib/alert-visibility";
import { VEHICLE_BRAND_CATALOG, findBrandOption } from "@/lib/vehicle-brand-catalog";
import type { CustomFieldDef } from "@/lib/custom-fields";
import { CustomFieldInputs } from "./CustomFieldInputs";

const initialState: ActionState = {};

function Field({
  id,
  label,
  defaultValue,
  type = "text",
  required = false,
  disabled = false,
}: {
  id: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
  required?: boolean;
  disabled?: boolean;
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
        disabled={disabled}
        defaultValue={defaultValue ?? ""}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100"
      />
    </div>
  );
}

const CATALOG_INPUT_CLASS =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:bg-gray-100";

// Busca sin importar mayúsculas/minúsculas ni espacios de sobra, para
// preseleccionar en un <select> un valor que ya estaba escrito a mano en
// la BD antes de que existiera el catálogo (p.ej. si ya dice "RAM", se
// selecciona la opción "RAM" en vez de dejarlo como texto suelto).
function findInOptions(options: string[], value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return options.find((o) => o.toLowerCase() === normalized);
}

// Estado inicial de un campo (Línea o Modelo) dado el catálogo de la marca
// ya detectada: si el valor guardado calza con una opción, se preselecciona;
// si no calza pero hay algo escrito, se manda a "Otro" con ese texto; si no
// hay nada guardado y la marca solo tiene una opción posible, se
// autorellena sola (nada que elegir); si tiene varias, se deja en blanco
// para que la persona escoja (p.ej. Chevrolet: 1500 o 2500).
function initCatalogField(
  hasBrand: boolean,
  options: string[],
  defaultValue?: string | null
): { sel: string; text: string } {
  if (!hasBrand || options.length === 0) return { sel: "", text: defaultValue ?? "" };
  const match = findInOptions(options, defaultValue);
  if (match) return { sel: match, text: "" };
  if (defaultValue) return { sel: OTRO, text: defaultValue };
  if (options.length === 1) return { sel: options[0], text: "" };
  return { sel: "", text: "" };
}

const OTRO = "__OTRO__";

// Marca/Línea/Modelo con catálogo (ver lib/vehicle-brand-catalog.ts). Al
// elegir una marca conocida, Línea y Modelo se vuelven selects con las
// opciones de esa marca: si solo hay una, se autorellena sola; si hay
// varias (p.ej. Chevrolet: 1500 o 2500) la persona elige entre ellas. Si la
// marca no tiene catálogo para ese campo (p.ej. Nissan no tiene líneas
// listadas), o se elige "Otro" en cualquiera de los tres, queda como texto
// libre para lo que no esté en la lista.
function VehicleBrandFields({
  defaultMarca,
  defaultLinea,
  defaultModelo,
}: {
  defaultMarca?: string | null;
  defaultLinea?: string | null;
  defaultModelo?: string | null;
}) {
  const initialOption = findBrandOption(defaultMarca);
  const [marca, setMarca] = useState<string>(initialOption ? initialOption.marca : defaultMarca ? OTRO : "");
  const [otraMarca, setOtraMarca] = useState(initialOption ? "" : defaultMarca ?? "");

  const lineaInit = initCatalogField(!!initialOption, initialOption?.lineas ?? [], defaultLinea);
  const [linea, setLinea] = useState(lineaInit.sel);
  const [otraLinea, setOtraLinea] = useState(lineaInit.text);

  const modeloInit = initCatalogField(!!initialOption, initialOption?.modelos ?? [], defaultModelo);
  const [modelo, setModelo] = useState(modeloInit.sel);
  const [otraModelo, setOtraModelo] = useState(modeloInit.text);

  const option = marca === OTRO || marca === "" ? undefined : VEHICLE_BRAND_CATALOG.find((o) => o.marca === marca);

  function handleMarcaChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    setMarca(value);
    const nextOption =
      value === OTRO || value === "" ? undefined : VEHICLE_BRAND_CATALOG.find((o) => o.marca === value);
    setLinea(nextOption && nextOption.lineas.length === 1 ? nextOption.lineas[0] : "");
    setOtraLinea("");
    setModelo(nextOption && nextOption.modelos.length === 1 ? nextOption.modelos[0] : "");
    setOtraModelo("");
  }

  return (
    <>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="marcaCatalogo">
          Marca
        </label>
        <select id="marcaCatalogo" value={marca} onChange={handleMarcaChange} className={CATALOG_INPUT_CLASS}>
          <option value="">Selecciona...</option>
          {VEHICLE_BRAND_CATALOG.map((o) => (
            <option key={o.marca} value={o.marca}>
              {o.marca}
            </option>
          ))}
          <option value={OTRO}>Otro</option>
        </select>
        {marca === OTRO ? (
          <input
            name="marca"
            value={otraMarca}
            onChange={(e) => setOtraMarca(e.target.value)}
            placeholder="Escribe la marca"
            className={`mt-2 ${CATALOG_INPUT_CLASS}`}
          />
        ) : (
          <input type="hidden" name="marca" value={marca} />
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="lineaCatalogo">
          Línea
        </label>
        {option && option.lineas.length > 0 ? (
          <>
            <select
              id="lineaCatalogo"
              value={linea}
              onChange={(e) => {
                setLinea(e.target.value);
                setOtraLinea("");
              }}
              className={CATALOG_INPUT_CLASS}
            >
              <option value="">Selecciona...</option>
              {option.lineas.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
              <option value={OTRO}>Otro</option>
            </select>
            {linea === OTRO ? (
              <input
                name="linea"
                value={otraLinea}
                onChange={(e) => setOtraLinea(e.target.value)}
                placeholder="Escribe la línea"
                className={`mt-2 ${CATALOG_INPUT_CLASS}`}
              />
            ) : (
              <input type="hidden" name="linea" value={linea} />
            )}
          </>
        ) : (
          <input
            id="lineaCatalogo"
            name="linea"
            value={otraLinea}
            onChange={(e) => setOtraLinea(e.target.value)}
            className={CATALOG_INPUT_CLASS}
          />
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="modeloCatalogo">
          Modelo
        </label>
        {option && option.modelos.length > 0 ? (
          <>
            <select
              id="modeloCatalogo"
              value={modelo}
              onChange={(e) => {
                setModelo(e.target.value);
                setOtraModelo("");
              }}
              className={CATALOG_INPUT_CLASS}
            >
              <option value="">Selecciona...</option>
              {option.modelos.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value={OTRO}>Otro</option>
            </select>
            {modelo === OTRO ? (
              <input
                name="modelo"
                value={otraModelo}
                onChange={(e) => setOtraModelo(e.target.value)}
                placeholder="Escribe el modelo"
                className={`mt-2 ${CATALOG_INPUT_CLASS}`}
              />
            ) : (
              <input type="hidden" name="modelo" value={modelo} />
            )}
          </>
        ) : (
          <input
            id="modeloCatalogo"
            name="modelo"
            value={otraModelo}
            onChange={(e) => setOtraModelo(e.target.value)}
            className={CATALOG_INPUT_CLASS}
          />
        )}
      </div>
    </>
  );
}

// Una válvula = su fecha de fabricación (la que cuenta para la alerta) más
// el número de serie (código grabado) tal cual se leyó en campo, como en el
// Excel de flotilla (ver lib/ficha-campos.ts).
function ValvulaInputs({ valvula, sheet }: { valvula: ValvulaDef; sheet: VehicleTechnicalSheet | null }) {
  return (
    <div className="rounded-md border border-gray-200 bg-white/60 p-2">
      <p className="mb-1 text-sm font-medium text-ink">
        {valvula.etiqueta}
        {!valvula.entraEnAlerta && (
          <span className="ml-1 text-xs font-normal text-gray-500">(referencia, no entra en la alerta)</span>
        )}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-xs text-gray-600" htmlFor={valvula.fecha}>
            Fecha de fabricación
          </label>
          <input
            id={valvula.fecha}
            name={valvula.fecha}
            type="date"
            defaultValue={toDateInputValue(sheet?.[valvula.fecha])}
            className={CATALOG_INPUT_CLASS}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-gray-600" htmlFor={valvula.codigo}>
            Número de serie
          </label>
          <input
            id={valvula.codigo}
            name={valvula.codigo}
            type="text"
            maxLength={150}
            defaultValue={sheet?.[valvula.codigo] ?? ""}
            placeholder="p. ej. 03C26"
            className={CATALOG_INPUT_CLASS}
          />
        </div>
      </div>
    </div>
  );
}

function CamposTexto({ campos, sheet }: { campos: CampoTextoDef[]; sheet: VehicleTechnicalSheet | null }) {
  return (
    <>
      {campos.map(({ campo, etiqueta }) => (
        <Field key={campo} id={campo} label={etiqueta} defaultValue={sheet?.[campo]} />
      ))}
    </>
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
  showTankNameplateSection = false,
  showInspeccionesSection = true,
  showMaintenancePreventiveSection = true,
  showAutomovilSection = true,
  showGobernadorSection = false,
  showTractocamionSection = false,
  showSemirremolqueSection = false,
  showUnidadAsignada = false,
  lockCombustibleGasLpGasolina = false,
  camposExtra = [],
  valoresExtra = {},
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
  // Solo Auto-Tanques: transcripción literal de la placa metálica del
  // tanque (ver comentario en prisma/schema.prisma). Distinto de
  // showTankSection: esos campos ya existían y alimentan cálculos; estos
  // son puros datos de referencia para llenar a mano.
  showTankNameplateSection?: boolean;
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
  // Gobernador de velocidad: Auto-Tanques y Tractocamiones.
  showGobernadorSection?: boolean;
  // Transportadora Kino (ver lib/kino-sections.ts).
  showTractocamionSection?: boolean;
  showSemirremolqueSection?: boolean;
  showUnidadAsignada?: boolean;
  // Vehículo con tanque de carburación, y Auto-Tanques cuyo número
  // económico se repite en Vehículo con tanque de carburación (misma
  // ciudad), siempre usan Gas LP/Gasolina: el select queda visible pero el
  // valor se fuerza en el servidor (ver actions/vehicle-actions.ts) sin
  // importar lo que se elija aquí.
  lockCombustibleGasLpGasolina?: boolean;
  // Recuadros extra agregados desde /admin/campos (ver lib/custom-fields.ts).
  camposExtra?: CustomFieldDef[];
  valoresExtra?: Record<string, string>;
}) {
  const action = upsertTechnicalSheet.bind(null, vehicleId);
  const [state, formAction] = useFormState(action, initialState);
  // Bloqueada por default: sin esto, cualquiera que entre a la ficha técnica
  // puede cambiar o borrar un valor sin querer con solo dar clic. Hay que
  // apretar "Editar" para poder tocar los campos.
  const [locked, setLocked] = useState(true);
  const [tieneValvula85, setTieneValvula85] = useState(sheet?.tieneValvulaMaximoLlenado85 ?? false);
  const [tieneGobernador, setTieneGobernador] = useState(sheet?.tieneGobernador ?? false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCancel() {
    formRef.current?.reset();
    setLocked(true);
    setTieneValvula85(sheet?.tieneValvulaMaximoLlenado85 ?? false);
    setTieneGobernador(sheet?.tieneGobernador ?? false);
  }

  // Calidad del extintor: se puede cambiar sin desbloquear toda la ficha
  // técnica (ver Extintor más abajo, este select vive fuera del <fieldset>
  // bloqueado). Llama directo a la server action, sin <form> propio, para no
  // anidar un <form> dentro de este.
  const [calidadPending, startCalidadTransition] = useTransition();
  const [calidadMessage, setCalidadMessage] = useState<ActionState>({});
  const calidadSelectRef = useRef<HTMLSelectElement>(null);
  // Al elegir "Mala" no se guarda de inmediato: primero se pide una
  // observación explicando por qué (aplica a todas las unidades, no solo a
  // Estaciones de carburación). El resto de los cambios se sigue guardando
  // al instante, como antes.
  const [pidiendoObservacion, setPidiendoObservacion] = useState(false);
  const [observacionMala, setObservacionMala] = useState("");

  function submitCalidad(value: string, observacion?: string) {
    const formData = new FormData();
    formData.set("calidadExtintor", value);
    if (observacion) formData.set("observacion", observacion);
    startCalidadTransition(async () => {
      const result = await updateCalidadExtintor(vehicleId, {}, formData);
      setCalidadMessage(result);
      if (result.error && calidadSelectRef.current) {
        calidadSelectRef.current.value = sheet?.calidadExtintor ?? "";
      }
    });
  }

  function handleCalidadChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    if (value === "MALA") {
      setObservacionMala("");
      setPidiendoObservacion(true);
      return;
    }
    setPidiendoObservacion(false);
    submitCalidad(value);
  }

  function confirmarObservacionMala() {
    if (!observacionMala.trim()) return;
    submitCalidad("MALA", observacionMala.trim());
    setPidiendoObservacion(false);
  }

  function cancelarCambioAMala() {
    if (calidadSelectRef.current) {
      calidadSelectRef.current.value = sheet?.calidadExtintor ?? "";
    }
    setPidiendoObservacion(false);
  }
  // Vehículo con tanque de carburación tiene su propio sistema de gas LP
  // para el motor, con solo 4 de las 9 válvulas de Auto-Tanques (que son las
  // del tanque de carga que transporta, un sistema físico distinto) y con
  // nombres propios (ver VALVULAS_CARBURACION en lib/ficha-campos.ts;
  // lib/piece-catalog.ts y lib/valve-piece-sync.ts usan estos mismos 4
  // nombres al reemplazar una de estas válvulas desde un mantenimiento normal).
  const isCarburacionValves = sectionSlug === "vehiculo-con-tanque-de-carburacion";
  const extinguisherAlertLevel = getExtinguisherAlertLevel(
    sheet?.calidadExtintor,
    sheet?.fechaCalidadMalaExtintor
  );
  const maintenanceAlertLevel = getMaintenanceAlertLevel(sheet?.fechaProximoMantenimiento);
  const valveDatesForAlert = valveDatesFromSheet(sheet);
  const valveAlertLevel = getValveAlertLevel(valveDatesForAlert, aniosVigenciaValvulas(sectionSlug));
  const valveVencimiento = getValveVencimiento(valveDatesForAlert, aniosVigenciaValvulas(sectionSlug));
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
          <VehicleBrandFields
            defaultMarca={sheet?.marca}
            defaultLinea={sheet?.linea}
            defaultModelo={sheet?.modelo}
          />
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
              defaultValue={
                lockCombustibleGasLpGasolina ? (sheet?.combustible ?? "GAS_LP_GASOLINA") : sheet?.combustible ?? ""
              }
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
                Debe ser Gas LP o Gas LP/Gasolina (Vehículo con tanque de carburación o mismo
                número económico repetido ahí). Cualquier otro valor se guarda como Gas LP/Gasolina.
              </p>
            )}
            <CustomFieldInputs campos={camposExtra} seccion="automovil" valores={valoresExtra} />
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

      {showAutomovilSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.automovil}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
            Chofer y póliza
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="chofer" label="Chofer" defaultValue={sheet?.chofer} />
            <Field id="numeroPoliza" label="Número de póliza" defaultValue={sheet?.numeroPoliza} />
            <Field id="inciso" label="Inciso" defaultValue={sheet?.inciso} />
            {showUnidadAsignada && (
              <Field
                id="unidadAsignada"
                label={showTractocamionSection ? "Semirremolques asignados" : "Tractocamión asignado"}
                defaultValue={sheet?.unidadAsignada}
              />
            )}
          </div>
        </div>
      )}

      {showTractocamionSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.automovil}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Datos del tractocamión</h3>
          <div className="space-y-4">
            {CAMPOS_TRACTOCAMION.map((grupo) => (
              <div key={grupo.grupo}>
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{grupo.grupo}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <CamposTexto campos={grupo.campos} sheet={sheet} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showGobernadorSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.automovil}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Gobernador de velocidad</h3>
          <input type="hidden" name="tieneGobernadorPresente" value="1" />
          <label className="flex items-center gap-2 text-sm font-medium text-ink" htmlFor="tieneGobernador">
            <input
              id="tieneGobernador"
              name="tieneGobernador"
              type="checkbox"
              checked={tieneGobernador}
              onChange={(event) => setTieneGobernador(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"
            />
            ¿Tiene gobernador instalado?
          </label>
          {tieneGobernador && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field id="numeroGobernador" label="Número de identificación" defaultValue={sheet?.numeroGobernador} />
              <Field id="empresaGobernador" label="Empresa que lo instaló" defaultValue={sheet?.empresaGobernador} />
            </div>
          )}
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
            {showTankNameplateSection && (
              <>
                <Field
                  id="placaPresionMaximaTrabajo"
                  label="Presión máxima de trabajo (kg/cm²)"
                  defaultValue={sheet?.placaPresionMaximaTrabajo}
                />
                <Field
                  id="placaTemperaturaDiseno"
                  label="Temperatura de diseño (°C)"
                  defaultValue={sheet?.placaTemperaturaDiseno}
                />
                <Field id="placaCabezales" label="Cabezales" defaultValue={sheet?.placaCabezales} />
                <Field
                  id="placaDiametroExterior"
                  label="Diámetro exterior (m)"
                  defaultValue={sheet?.placaDiametroExterior}
                />
                <Field
                  id="placaLongitudTotal"
                  label="Longitud total (m)"
                  defaultValue={sheet?.placaLongitudTotal}
                />
                <Field
                  id="placaEspesorMinPlacaCuerpo"
                  label="Espesor mín. placa cuerpo (mm)"
                  defaultValue={sheet?.placaEspesorMinPlacaCuerpo}
                />
                <Field
                  id="placaMaterialCuerpo"
                  label="Material cuerpo"
                  defaultValue={sheet?.placaMaterialCuerpo}
                />
                <Field
                  id="placaEspesorMinPlacaCabeza"
                  label="Espesor mín. placa cabeza (mm)"
                  defaultValue={sheet?.placaEspesorMinPlacaCabeza}
                />
                <Field
                  id="placaMaterialCabeza"
                  label="Material cabeza"
                  defaultValue={sheet?.placaMaterialCabeza}
                />
                <Field
                  id="placaNormaFabricacion"
                  label="Norma de fabricación"
                  defaultValue={sheet?.placaNormaFabricacion}
                />
                <Field id="placaDT" label="D.T." defaultValue={sheet?.placaDT} />
                <Field
                  id="placaNumeroSeriePropietario"
                  label="No. de serie propietario"
                  defaultValue={sheet?.placaNumeroSeriePropietario}
                />
                <Field
                  id="placaCapacidadPorcentaje"
                  label="Capacidad (%)"
                  defaultValue={sheet?.placaCapacidadPorcentaje}
                />
                <Field id="placaCapacidadKg" label="Capacidad (kg)" defaultValue={sheet?.placaCapacidadKg} />
                <Field id="placaTara" label="Tara (kg)" defaultValue={sheet?.placaTara} />
                <Field
                  id="placaRayosXCuerpo"
                  label="Rayos X cuerpo (%)"
                  defaultValue={sheet?.placaRayosXCuerpo}
                />
                <Field id="placaRelevo" label="Relevo (%)" defaultValue={sheet?.placaRelevo} />
                <Field
                  id="placaRayosXCabeza"
                  label="Rayos X cabeza (%)"
                  defaultValue={sheet?.placaRayosXCabeza}
                />
                <Field
                  id="placaPresionDiseno"
                  label="Presión de diseño (kg/cm²)"
                  defaultValue={sheet?.placaPresionDiseno}
                />
                <Field
                  id="placaFechaPruebaOriginal"
                  label="Fecha prueba original"
                  defaultValue={sheet?.placaFechaPruebaOriginal}
                />
                <Field
                  id="placaPresionMaximaVapor"
                  label="Presión máxima de vapor (kg/cm²)"
                  defaultValue={sheet?.placaPresionMaximaVapor}
                />
                <Field id="placaContenido" label="Contenido" defaultValue={sheet?.placaContenido} />
              </>
            )}
            <CustomFieldInputs campos={camposExtra} seccion="tanque" valores={valoresExtra} />
          </div>
        </div>
      )}

      {showSemirremolqueSection && (
        <div className={`rounded-md p-4 ${SECTION_STYLES.tanque}`}>
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Datos del semirremolque</h3>
          <div className="space-y-4">
            {CAMPOS_SEMIRREMOLQUE.map((grupo) => (
              <div key={grupo.grupo}>
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{grupo.grupo}</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <CamposTexto campos={grupo.campos} sheet={sheet} />
                </div>
              </div>
            ))}
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

      </fieldset>

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
          <fieldset disabled={locked} className="contents">
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
          </fieldset>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="calidadExtintor">
              Calidad
            </label>
            {/* Fuera del <fieldset> bloqueado a propósito: se guarda solo al
                cambiar, sin necesidad de apretar "Editar" en toda la ficha
                técnica (ver handleCalidadChange arriba). */}
            <select
              id="calidadExtintor"
              name="calidadExtintor"
              ref={calidadSelectRef}
              defaultValue={sheet?.calidadExtintor ?? ""}
              onChange={handleCalidadChange}
              disabled={calidadPending || pidiendoObservacion}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-60"
            >
              <option value="">Selecciona...</option>
              {Object.entries(calidadExtintorLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {pidiendoObservacion ? (
              <div className="mt-2 flex flex-col gap-2 rounded-md border border-orange-300 bg-orange-50 p-3">
                <label className="text-xs font-medium text-orange-900" htmlFor="observacionExtintorMala">
                  Explica por qué el extintor está en mal estado
                </label>
                <textarea
                  id="observacionExtintorMala"
                  value={observacionMala}
                  onChange={(e) => setObservacionMala(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={confirmarObservacionMala}
                    disabled={!observacionMala.trim() || calidadPending}
                    className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-60"
                  >
                    {calidadPending ? "Guardando…" : "Guardar"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelarCambioAMala}
                    className="rounded-md border border-gray-300 px-3 py-1 text-xs text-ink hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <CustomFieldInputs campos={camposExtra} seccion="extintor" valores={valoresExtra} />
                </div>
              </div>
            ) : (
              <p className="mt-1 text-xs text-ink">
                {calidadPending
                  ? "Guardando…"
                  : calidadMessage.error
                    ? calidadMessage.error
                    : calidadMessage.success
                      ? calidadMessage.success
                      : "Se guarda automáticamente al cambiar."}
              </p>
            )}
          </div>
        </div>
        <p className="mt-2 text-xs text-ink">
          Cuando la calidad se marca como “Mala” se genera una alerta para reemplazar el
          extintor: amarilla los primeros 2 días, roja a partir del día 2.
        </p>
      </div>

      <fieldset disabled={locked} className="space-y-6">

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
            <CustomFieldInputs campos={camposExtra} seccion="mangueras" valores={valoresExtra} />
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
          <div className="mb-3 max-w-xs rounded-md border-2 border-primary/40 bg-primary/5 p-3">
            <Field
              id="fechaInstalacionValvulas"
              label="Fecha de instalación del juego de válvulas"
              type="date"
              defaultValue={toDateInputValue(sheet?.fechaInstalacionValvulas)}
            />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
            Fecha de fabricación de cada válvula
          </p>
          {isCarburacionValves ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {VALVULAS_CARBURACION.map((valvula) => (
                <ValvulaInputs key={valvula.fecha} valvula={valvula} sheet={sheet} />
              ))}
              <CustomFieldInputs campos={camposExtra} seccion="valvulas" valores={valoresExtra} />
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {VALVULAS_TANQUE_CARGA.map((valvula) => (
                  <ValvulaInputs key={valvula.fecha} valvula={valvula} sheet={sheet} />
                ))}
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
                  <div className="mt-3 max-w-md">
                    <ValvulaInputs valvula={VALVULA_MAXIMO_LLENADO_85} sheet={sheet} />
                  </div>
                )}
              </div>
              <div className="mt-3 rounded-md border border-gray-200 bg-white/60 p-3">
                <p className="mb-2 text-sm font-medium text-ink">Manguera de surtir</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field
                    id="fechaFabricacionMangueraSurtir"
                    label="Fecha de fabricación"
                    type="date"
                    defaultValue={toDateInputValue(sheet?.fechaFabricacionMangueraSurtir)}
                  />
                  <Field id="medidaMangueraSurtir" label="Medida" defaultValue={sheet?.medidaMangueraSurtir} />
                </div>
              </div>
            </>
          )}
          <p className="mt-2 text-xs text-ink">
            El cambio de válvulas debe hacerse cada {aniosVigenciaValvulas(sectionSlug)} años. El aviso se calcula sobre la fecha de
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
          <CustomFieldInputs campos={camposExtra} seccion="visualExterna" valores={valoresExtra} />
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
          <CustomFieldInputs campos={camposExtra} seccion="hermeticidad" valores={valoresExtra} />
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
          <CustomFieldInputs campos={camposExtra} seccion="visualInterna" valores={valoresExtra} />
        </div>
        <p className="mt-2 text-xs text-ink">
          La primera vence a los 10 años de la fecha de fabricación del tanque; si se deja vacía,
          se calcula sola al guardar. De ahí en adelante, cada vez que se acepte un registro nuevo
          se recorre 5 años, no 10. Marca en amarillo/rojo con advertencias en el panel de alertas
          del inicio, igual que las demás pruebas.
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
          <CustomFieldInputs campos={camposExtra} seccion="ultrasonido" valores={valoresExtra} />
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
          <CustomFieldInputs campos={camposExtra} seccion="hidrostatica" valores={valoresExtra} />
        </div>
        <p className="mt-2 text-xs text-ink">
          La primera vence a los 10 años de la fecha de fabricación del tanque y de ahí en
          adelante cada 5, con el mismo cálculo automático que la inspección visual interna.
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
