"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { guardarDocumentoDeLote, cambiarDescarteDocumentoDeLote } from "@/actions/lote-documentos-actions";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "@/components/admin/FormMessage";
import {
  TIPOS_LOTE,
  CAMPOS_POR_TIPO,
  tipoLoteLabel,
  tipoAplicaEnApartado,
  esPruebaDeTanque,
  type ItemLote,
  type TipoLote,
  type DefCampo,
} from "@/lib/lote-documentos";
import { PaginasDelLote } from "./PaginasDelLote";

export type UnidadParaLote = {
  id: string;
  etiqueta: string; // número económico / nombre, con la ciudad si el lote es de Administración
  apartado: string;
  sectionSlug: string;
  activo: boolean;
  tanques: { id: string; etiqueta: string }[];
};

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
// Lo obligatorio que la IA no pudo llenar se resalta para que no se pase.
const inputFaltanteClass =
  "w-full rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Guardar en su bitácora"}
    </button>
  );
}

function BotonSecundario({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-ink transition hover:bg-gray-50 disabled:opacity-60"
    >
      {pending ? "..." : texto}
    </button>
  );
}

function Campo({ def, item, idBase }: { def: DefCampo; item: ItemLote; idBase: string }) {
  const id = `${idBase}-${def.campo}`;
  const valor = item[def.campo] ?? "";
  const clase = def.requerido && !valor ? inputFaltanteClass : inputClass;
  const etiqueta = (
    <label className="mb-1 block text-sm font-medium text-ink" htmlFor={id}>
      {def.etiqueta}
      {def.requerido && <span className="text-accent"> *</span>}
    </label>
  );
  if (def.control === "opciones") {
    return (
      <div>
        {etiqueta}
        <select id={id} name={def.campo} defaultValue={valor} className={clase}>
          <option value="">— Elegir —</option>
          {def.opciones?.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (def.control === "textoLargo") {
    return (
      <div className="sm:col-span-2 lg:col-span-3">
        {etiqueta}
        <textarea id={id} name={def.campo} defaultValue={valor} rows={2} className={clase} />
      </div>
    );
  }
  return (
    <div>
      {etiqueta}
      <input
        id={id}
        name={def.campo}
        type={def.control === "fecha" ? "date" : def.control === "numero" ? "number" : "text"}
        min={def.control === "numero" ? 0 : undefined}
        defaultValue={valor}
        className={clase}
      />
    </div>
  );
}

function DescarteForm({ loteId, itemId, descartar }: { loteId: string; itemId: string; descartar: boolean }) {
  const [state, formAction] = useFormState(
    cambiarDescarteDocumentoDeLote.bind(null, loteId, itemId, descartar),
    initialState
  );
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <BotonSecundario texto={descartar ? "Descartar" : "Restaurar"} />
      {state.error && <FormMessage state={state} />}
    </form>
  );
}

export function DocumentoDeLoteForm({
  loteId,
  item,
  numero,
  unidades,
  paginasTotal,
  srcEscaneo,
  bloqueado,
}: {
  loteId: string;
  item: ItemLote;
  numero: number;
  unidades: UnidadParaLote[];
  paginasTotal: number;
  srcEscaneo: string;
  bloqueado: boolean;
}) {
  const [tipo, setTipo] = useState<TipoLote>(item.tipo);
  const [vehicleId, setVehicleId] = useState(item.vehicleId ?? "");
  const [state, formAction] = useFormState(guardarDocumentoDeLote.bind(null, loteId, item.id), initialState);

  const unidad = unidades.find((u) => u.id === vehicleId);
  const pideTanque = Boolean(unidad && esPruebaDeTanque(tipo) && unidad.tanques.length > 1);
  const noAplica = unidad && !tipoAplicaEnApartado(tipo, unidad.sectionSlug);
  const rango = item.paginaInicio === item.paginaFin ? `Página ${item.paginaInicio}` : `Páginas ${item.paginaInicio}–${item.paginaFin}`;
  const idBase = `doc-${item.id}`;

  const encabezado = (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-primary">
        {numero}. {tipoLoteLabel[item.tipo]} · {rango}
      </h3>
      <span className="text-xs text-gray-500">{item.origen === "IA" ? "Detectado por la IA" : "Agregado a mano"}</span>
    </div>
  );

  if (item.estado !== "PENDIENTE") {
    const guardado = item.estado === "GUARDADO";
    const nombreUnidad = unidades.find((u) => u.id === item.vehicleId)?.etiqueta;
    return (
      <div className={`rounded-lg border p-4 ${guardado ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50"}`}>
        {encabezado}
        <p className={`text-sm ${guardado ? "text-green-800" : "text-gray-600"}`}>
          {guardado ? (item.mensaje ?? "Guardado.") : `Descartado${nombreUnidad ? ` (${nombreUnidad})` : ""}.`}
          {item.resueltoPor && (
            <span className="text-gray-500">
              {" "}
              — {item.resueltoPor}
              {item.resueltoEl ? `, ${new Date(item.resueltoEl).toLocaleString("es-MX")}` : ""}
            </span>
          )}
        </p>
        {!guardado && !bloqueado && (
          <div className="mt-3">
            <DescarteForm loteId={loteId} itemId={item.id} descartar={false} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      {encabezado}
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <PaginasDelLote src={srcEscaneo} desde={item.paginaInicio} hasta={item.paginaFin} />

        <div className="space-y-3">
          {item.descripcionLector && <p className="text-sm text-ink">{item.descripcionLector}</p>}
          {item.dudas.length > 0 && (
            <ul className="list-disc space-y-1 rounded-md border border-amber-200 bg-amber-50 py-2 pl-8 pr-3 text-sm text-amber-900">
              {item.dudas.map((duda, i) => (
                <li key={i}>{duda}</li>
              ))}
            </ul>
          )}
          {/* El motivo del último intento fallido, guardado en el lote: sigue
              visible al volver otro día. Recién fallado lo muestra FormMessage. */}
          {item.mensaje && !state.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{item.mensaje}</p>
          )}

          <form action={formAction} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor={`${idBase}-tipo`}>
                  Tipo de documento<span className="text-accent"> *</span>
                </label>
                <select
                  id={`${idBase}-tipo`}
                  name="tipo"
                  value={tipo}
                  onChange={(e) => setTipo(e.target.value as TipoLote)}
                  className={inputClass}
                >
                  {TIPOS_LOTE.map((t) => (
                    <option key={t} value={t}>
                      {tipoLoteLabel[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-1 lg:col-span-2">
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor={`${idBase}-unidad`}>
                  Unidad<span className="text-accent"> *</span>
                  {item.identificador && (
                    <span className="ml-2 text-xs font-normal text-gray-500">En el documento: {item.identificador}</span>
                  )}
                </label>
                <select
                  id={`${idBase}-unidad`}
                  name="vehicleId"
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  className={vehicleId ? inputClass : inputFaltanteClass}
                >
                  <option value="">— Elegir unidad —</option>
                  {Object.entries(
                    unidades.reduce<Record<string, UnidadParaLote[]>>((grupos, u) => {
                      (grupos[u.apartado] ??= []).push(u);
                      return grupos;
                    }, {})
                  ).map(([apartado, lista]) => (
                    <optgroup key={apartado} label={apartado}>
                      {lista.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.etiqueta}
                          {u.activo ? "" : " (dada de baja)"}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              {pideTanque && unidad && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-ink" htmlFor={`${idBase}-tanque`}>
                    Tanque<span className="text-accent"> *</span>
                  </label>
                  <select
                    id={`${idBase}-tanque`}
                    name="tanqueId"
                    defaultValue={item.tanqueId ?? ""}
                    className={item.tanqueId ? inputClass : inputFaltanteClass}
                  >
                    <option value="">— Elegir tanque —</option>
                    {unidad.tanques.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor={`${idBase}-desde`}>
                  Páginas del escaneo
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id={`${idBase}-desde`}
                    name="paginaInicio"
                    type="number"
                    min={1}
                    max={paginasTotal}
                    defaultValue={item.paginaInicio}
                    className={inputClass}
                  />
                  <span className="text-sm text-gray-500">a</span>
                  <input
                    name="paginaFin"
                    type="number"
                    min={1}
                    max={paginasTotal}
                    defaultValue={item.paginaFin}
                    aria-label="Página final"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>

            {noAplica && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                “{tipoLoteLabel[tipo]}” no aplica en {unidad.apartado}: cambia el tipo o la unidad.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CAMPOS_POR_TIPO[tipo].map((def) => (
                // La key incluye el tipo: al cambiarlo, cada recuadro se vuelve
                // a crear con lo leído para ese campo en vez de arrastrar lo
                // del tipo anterior.
                <Campo key={`${tipo}-${def.campo}`} def={def} item={item} idBase={idBase} />
              ))}
            </div>

            <FormMessage state={state} />
            {!bloqueado && (
              <div className="flex flex-wrap items-center gap-3">
                <BotonGuardar />
                <p className="text-xs text-gray-500">
                  Se guarda solo {item.paginaInicio === item.paginaFin ? "esa página" : "esas páginas"} como PDF en la
                  bitácora, con las mismas reglas que el formulario de la unidad.
                </p>
              </div>
            )}
          </form>
          {!bloqueado && <DescarteForm loteId={loteId} itemId={item.id} descartar={true} />}
        </div>
      </div>
    </div>
  );
}
