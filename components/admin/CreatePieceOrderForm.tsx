"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  usaCatalogoDePiezas,
  type OrdenTipo,
  type ConsumibleUnidad,
} from "@/lib/inventory-enums";
import {
  PIECE_CATALOG,
  PIECE_GROUPS,
  getPieceCategoriesForGroup,
  type PieceGroup,
} from "@/lib/piece-catalog";
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

export type VehicleOption = {
  id: string;
  numeroEconomico: string;
  section: { name: string };
  // Si es una Estación de carburación / Planta en vez de una unidad normal
  // (ver lib/estacion-sections.ts), para el selector "¿Para qué es la orden?".
  esEstacion?: boolean;
};

export type EquipoOption = {
  id: string;
  nombre: string;
  codigo: string | null;
  vehicleRecord: { numeroEconomico: string } | null;
};

export function CreatePieceOrderForm({
  sectionId,
  vehicles,
  equipos,
  pieceCatalog,
  categoriasPorGrupo,
}: {
  sectionId: string;
  vehicles: VehicleOption[];
  // Equipos activos de la ciudad, para el checklist de "sustituye a un
  // equipo que ya existe" (solo aplica a tipo "Equipo").
  equipos?: EquipoOption[];
  // Catálogo ya resuelto en el servidor: lista fija + piezas agregadas desde
  // /admin/piezas (ver lib/piece-catalog-runtime.ts).
  pieceCatalog?: Record<string, string[]>;
  categoriasPorGrupo?: Record<PieceGroup, string[]>;
}) {
  const action = createPieceOrder.bind(null, sectionId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const searchParams = useSearchParams();

  // Viene de una alerta (p.ej. extintor en mal estado, ver
  // components/dashboard/ExtinguisherAlertsPanel.tsx) que ya sabe qué pieza y
  // para qué unidad hace falta ordenar.
  const prefillTipo = (searchParams.get("prefillTipo") as OrdenTipo | null) ?? "";
  const prefillNombre = searchParams.get("prefillNombre") ?? "";
  const prefillVehicle = searchParams.get("prefillVehicle") ?? "";
  const hasPrefill = Boolean(prefillTipo || prefillNombre || prefillVehicle);

  // La unidad no se captura: se deduce del tipo. Solo el consumible deja
  // elegir entre litros y kilos, y ese selector aparece únicamente entonces.
  const [tipo, setTipo] = useState<OrdenTipo | "">(prefillTipo);
  const [unidadConsumible, setUnidadConsumible] = useState<ConsumibleUnidad>("LTS");
  const [cantidad, setCantidad] = useState("1");
  // Para REFACCION/PIEZA/CONSUMIBLE, el nombre se puede elegir del catálogo
  // de piezas de unidad en vez de escribirlo a mano (ver lib/piece-catalog.ts,
  // el mismo catálogo de "Registrar mantenimiento"). "" = escribir a mano.
  const [piezaCatalogo, setPiezaCatalogo] = useState("");
  // Para qué es la orden: acota tanto el catálogo de piezas (cuando aplica)
  // como el selector de "Unidad destino" a solo unidades o solo estaciones
  // (ver esEstacion en VehicleOption), igual que ya se hace al elegir la
  // pieza del catálogo. Siempre visible, no solo cuando hay catálogo.
  const [destino, setDestino] = useState<PieceGroup>("Unidades");
  const mostrarCatalogo = tipo !== "" && usaCatalogoDePiezas(tipo);
  const catalogo = pieceCatalog ?? PIECE_CATALOG;
  const categoriasDelGrupo = categoriasPorGrupo?.[destino] ?? getPieceCategoriesForGroup(destino);
  const vehiculosDelDestino = vehicles.filter((v) =>
    destino === "Estaciones de carburación" ? v.esEstacion : !v.esEstacion
  );

  // Checklist al elegir tipo "Equipo": si ya se sabe que sustituye a un
  // equipo que ya existe, se liga aquí a modo de referencia (ver
  // PieceOrder.sustituyeEquipoId). No lo da de baja solo.
  const [esSustitucion, setEsSustitucion] = useState(false);

  useEffect(() => {
    if (hasPrefill && detailsRef.current) {
      detailsRef.current.open = true;
    }
  }, [hasPrefill]);

  const esConsumible = tipo === "CONSUMIBLE";
  const unidad = tipo ? unidadParaTipo(tipo, unidadConsumible) : null;
  const cantidadNum = Number(cantidad);
  const vistaPrevia =
    unidad && Number.isInteger(cantidadNum) && cantidadNum >= 1
      ? formatCantidad(cantidadNum, unidad)
      : null;

  return (
    <details ref={detailsRef} className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
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
          setPiezaCatalogo("");
          setDestino("Unidades");
          setEsSustitucion(false);
        }}
        className="mt-4 space-y-3"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="op-destino">
              ¿Para qué es la orden?
            </label>
            <select
              id="op-destino"
              value={destino}
              onChange={(event) => {
                setDestino(event.target.value as PieceGroup);
                setPiezaCatalogo("");
              }}
              className={inputClass}
            >
              {PIECE_GROUPS.map((grupo) => (
                <option key={grupo} value={grupo}>
                  {grupo}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="op-tipo">
              Orden
            </label>
            <select
              id="op-tipo"
              name="tipo"
              required
              value={tipo}
              onChange={(event) => {
                const nuevoTipo = event.target.value as OrdenTipo | "";
                setTipo(nuevoTipo);
                setPiezaCatalogo("");
                if (nuevoTipo !== "EQUIPO") setEsSustitucion(false);
              }}
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

          {mostrarCatalogo && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="op-piezaCatalogo">
                  Elegir del catálogo
                </label>
                <select
                  id="op-piezaCatalogo"
                  value={piezaCatalogo}
                  onChange={(event) => setPiezaCatalogo(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Escribir a mano</option>
                  {categoriasDelGrupo.map((categoria) => (
                    <optgroup key={categoria} label={categoria}>
                      {(catalogo[categoria] ?? []).map((pieza) => (
                        <option key={pieza} value={pieza}>
                          {pieza}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="op-nombre">
              {tipo ? ordenNombreLabels[tipo] : "Nombre"}
            </label>
            <input
              key={piezaCatalogo || "manual"}
              id="op-nombre"
              name="nombre"
              required
              disabled={!tipo}
              defaultValue={piezaCatalogo || prefillNombre}
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
            <select
              id="op-vehicleRecordId"
              name="vehicleRecordId"
              defaultValue={prefillVehicle}
              className={inputClass}
            >
              <option value="">— Se elige después, desde Inventarios —</option>
              {Array.from(
                vehiculosDelDestino.reduce((groups, vehicle) => {
                  const list = groups.get(vehicle.section.name) ?? [];
                  list.push(vehicle);
                  groups.set(vehicle.section.name, list);
                  return groups;
                }, new Map<string, typeof vehiculosDelDestino>())
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

        {tipo === "EQUIPO" && (equipos?.length ?? 0) > 0 && (
          <div className="rounded-md border border-dashed border-gray-300 p-3">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={esSustitucion}
                onChange={(event) => setEsSustitucion(event.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-accent"
              />
              Sustituye a un equipo que ya existe
            </label>
            {esSustitucion && (
              <div className="mt-2">
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="op-sustituyeEquipoId">
                  ¿A cuál equipo sustituye?
                </label>
                <select
                  id="op-sustituyeEquipoId"
                  name="sustituyeEquipoId"
                  required
                  defaultValue=""
                  className={`max-w-sm ${inputClass}`}
                >
                  <option value="" disabled>
                    Selecciona...
                  </option>
                  {equipos?.map((equipo) => (
                    <option key={equipo.id} value={equipo.id}>
                      {equipo.codigo ? `${equipo.codigo} — ${equipo.nombre}` : equipo.nombre}
                      {equipo.vehicleRecord ? ` (${equipo.vehicleRecord.numeroEconomico})` : ""}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Solo queda anotado como referencia: el equipo anterior se sigue dando de baja
                  desde su propia bitácora, registrando ahí el cambio.
                </p>
              </div>
            )}
          </div>
        )}

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
