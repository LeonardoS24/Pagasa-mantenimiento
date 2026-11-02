"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  addCustomField,
  updateCustomField,
  moveCustomField,
  deleteCustomField,
  addCustomSection,
  renameCustomSection,
  moveCustomSection,
  deleteCustomSection,
} from "@/actions/custom-field-actions";
import type { ActionState } from "@/actions/user-actions";
import {
  CAMPO_AMBITOS,
  CAMPO_APARTADOS,
  CAMPO_TIPOS,
  aplicaAApartado,
  campoAmbitoLabels,
  campoTipoLabels,
  labelDeApartado,
  seccionDePropia,
  seccionesPara,
  type CampoAmbito,
  type CampoTipo,
} from "@/lib/custom-fields";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export type CampoConUso = {
  id: string;
  ambito: CampoAmbito;
  seccion: string;
  apartadoSlug: string | null;
  etiqueta: string;
  tipo: CampoTipo;
  orden: number;
  // Cuántas unidades ya tienen algo capturado en este campo: se avisa antes
  // de borrarlo, porque borrarlo borra también esos valores.
  usos: number;
  // Solo cuando tipo === "LISTA": para poder revisar qué opciones se
  // guardaron sin tener que ir hasta la ficha técnica.
  opciones?: string[];
};

export type RecuadroPropio = {
  id: string;
  ambito: CampoAmbito;
  apartadoSlug: string | null;
  titulo: string;
  orden: number;
  campos: number;
};

function SubmitButton({ texto, pendiente }: { texto: string; pendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? pendiente : texto}
    </button>
  );
}

// Recuadros donde puede ir un campo de este ámbito y apartado: los de fábrica
// y los propios que valen para ese apartado.
function opcionesDeRecuadro(ambito: CampoAmbito, apartado: string | null, recuadros: RecuadroPropio[]) {
  return [
    ...seccionesPara(ambito).map((s) => ({ valor: s.id, etiqueta: s.label })),
    ...recuadros
      .filter((r) => r.ambito === ambito && aplicaAApartado(r.apartadoSlug, apartado))
      .map((r) => ({ valor: seccionDePropia(r.id), etiqueta: `${r.titulo} (nuevo)` })),
  ];
}

function FilaCampo({
  campo,
  esPrimero,
  esUltimo,
  recuadros,
}: {
  campo: CampoConUso;
  esPrimero: boolean;
  esUltimo: boolean;
  recuadros: RecuadroPropio[];
}) {
  const [isPending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [apartadoEdicion, setApartadoEdicion] = useState(campo.apartadoSlug ?? "");

  function mover(direccion: "arriba" | "abajo") {
    startTransition(async () => {
      const r = await moveCustomField(campo.id, direccion);
      setMensaje(r.error ?? null);
    });
  }

  function borrar() {
    const aviso =
      campo.usos > 0
        ? `¿Quitar "${campo.etiqueta}"? Se borrará también lo capturado en ${campo.usos} unidad(es). Esto no se puede deshacer.`
        : `¿Quitar "${campo.etiqueta}"?`;
    if (!confirm(aviso)) return;
    startTransition(async () => {
      const r = await deleteCustomField(campo.id);
      setMensaje(r.error ?? null);
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 px-3 py-2">
      {editando ? (
        <form
          action={async (formData) => {
            const r = await updateCustomField(campo.id, {}, formData);
            setMensaje(r.error ?? null);
            if (!r.error) setEditando(false);
          }}
          className="grid w-full gap-3 sm:grid-cols-2"
        >
          <label className="text-xs font-medium text-ink">
            Nombre del campo
            <input name="etiqueta" defaultValue={campo.etiqueta} autoFocus className={`mt-1 ${inputClass}`} />
          </label>
          <label className="text-xs font-medium text-ink">
            Se ve en
            <select
              name="apartadoSlug"
              value={apartadoEdicion}
              onChange={(e) => setApartadoEdicion(e.target.value)}
              className={`mt-1 ${inputClass}`}
            >
              <option value="">Todos los apartados</option>
              {CAMPO_APARTADOS[campo.ambito].map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-ink">
            Recuadro
            <select name="seccion" defaultValue={campo.seccion} className={`mt-1 ${inputClass}`}>
              {opcionesDeRecuadro(campo.ambito, apartadoEdicion || null, recuadros).map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </select>
          </label>
          {campo.tipo === "LISTA" && (
            <label className="text-xs font-medium text-ink sm:col-span-2">
              Opciones del listado (una por línea)
              <textarea name="opciones" rows={4} defaultValue={(campo.opciones ?? []).join("\n")} className={`mt-1 ${inputClass}`} />
            </label>
          )}
          <p className="text-xs text-gray-500 sm:col-span-2">
            El tipo ({campoTipoLabels[campo.tipo]}) no se cambia para no desacomodar lo ya capturado. Lo capturado se conserva al editar.
          </p>
          <div className="flex gap-3 sm:col-span-2">
            <button type="submit" className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-white hover:bg-primary-dark">
              Guardar cambios
            </button>
            <button type="button" onClick={() => setEditando(false)} className="text-xs text-ink hover:underline">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <>
          <span className="flex-1 text-sm text-ink">
            {campo.etiqueta}
            <span className="ml-2 text-xs text-gray-500">
              {campoTipoLabels[campo.tipo]}
              {campo.tipo === "LISTA" && campo.opciones && campo.opciones.length > 0 && <> ({campo.opciones.join(", ")})</>}
              {campo.usos > 0 && ` · capturado en ${campo.usos}`}
              {` · ${labelDeApartado(campo.ambito, campo.apartadoSlug)}`}
            </span>
          </span>
          <button
            type="button"
            disabled={isPending || esPrimero}
            onClick={() => mover("arriba")}
            title="Subir"
            className="rounded border border-gray-300 px-2 text-sm text-ink disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isPending || esUltimo}
            onClick={() => mover("abajo")}
            title="Bajar"
            className="rounded border border-gray-300 px-2 text-sm text-ink disabled:opacity-30"
          >
            ↓
          </button>
          <button type="button" onClick={() => setEditando(true)} className="text-xs font-medium text-primary hover:underline">
            Editar
          </button>
          <button type="button" disabled={isPending} onClick={borrar} className="text-xs text-red-600 hover:underline disabled:opacity-60">
            Quitar
          </button>
        </>
      )}
      {mensaje && <span className="w-full text-xs text-red-600">{mensaje}</span>}
    </li>
  );
}

function CabeceraRecuadro({
  recuadro,
  esPrimero,
  esUltimo,
}: {
  recuadro: RecuadroPropio;
  esPrimero: boolean;
  esUltimo: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      {editando ? (
        <form
          action={async (formData) => {
            const r = await renameCustomSection(recuadro.id, {}, formData);
            setMensaje(r.error ?? null);
            if (!r.error) setEditando(false);
          }}
          className="flex flex-wrap items-center gap-2"
        >
          <input name="titulo" defaultValue={recuadro.titulo} autoFocus className={`max-w-xs ${inputClass}`} />
          <button type="submit" className="text-xs font-medium text-primary hover:underline">
            Guardar
          </button>
          <button type="button" onClick={() => setEditando(false)} className="text-xs text-ink hover:underline">
            Cancelar
          </button>
        </form>
      ) : (
        <>
          <p className="text-xs font-semibold uppercase text-orange-700">
            {recuadro.titulo} <span className="font-normal normal-case text-gray-500">· recuadro nuevo · {labelDeApartado(recuadro.ambito, recuadro.apartadoSlug)}</span>
          </p>
          <button
            type="button"
            disabled={isPending || esPrimero}
            onClick={() => startTransition(async () => setMensaje((await moveCustomSection(recuadro.id, "arriba")).error ?? null))}
            title="Subir recuadro"
            className="rounded border border-gray-300 px-2 text-xs text-ink disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            disabled={isPending || esUltimo}
            onClick={() => startTransition(async () => setMensaje((await moveCustomSection(recuadro.id, "abajo")).error ?? null))}
            title="Bajar recuadro"
            className="rounded border border-gray-300 px-2 text-xs text-ink disabled:opacity-30"
          >
            ↓
          </button>
          <button type="button" onClick={() => setEditando(true)} className="text-xs font-medium text-primary hover:underline">
            Renombrar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              if (!confirm(`¿Quitar el recuadro "${recuadro.titulo}"?`)) return;
              startTransition(async () => setMensaje((await deleteCustomSection(recuadro.id)).error ?? null));
            }}
            className="text-xs text-red-600 hover:underline disabled:opacity-60"
          >
            Quitar recuadro
          </button>
        </>
      )}
      {mensaje && <span className="w-full text-xs text-red-600">{mensaje}</span>}
    </div>
  );
}

// Formato de las fichas técnicas por apartado: se eligen la ficha y el
// apartado (p. ej. Auto-Tanques) y aquí mismo se ve y se cambia todo lo que se
// le agregó: campos nuevos, recuadros nuevos y el orden. Lo de fábrica (que
// alimenta las alertas y los vencimientos) no se toca; lo agregado vive aparte
// (ver lib/custom-fields.ts), así que nunca afecta las alertas.
export function CustomFieldsPanel({ campos, recuadros }: { campos: CampoConUso[]; recuadros: RecuadroPropio[] }) {
  const [stateCampo, accionCampo] = useFormState(addCustomField, initialState);
  const [stateRecuadro, accionRecuadro] = useFormState(addCustomSection, initialState);
  const formCampoRef = useRef<HTMLFormElement>(null);
  const formRecuadroRef = useRef<HTMLFormElement>(null);

  // Lo que se está viendo.
  const [verAmbito, setVerAmbito] = useState<CampoAmbito>("VEHICULO");
  const [verApartado, setVerApartado] = useState(""); // "" = todos

  // Formulario de campo nuevo.
  const [ambito, setAmbito] = useState<CampoAmbito>("VEHICULO");
  const [apartadoCampo, setApartadoCampo] = useState("");
  const [tipo, setTipo] = useState<CampoTipo>("TEXTO");
  // Formulario de recuadro nuevo.
  const [ambitoRecuadro, setAmbitoRecuadro] = useState<CampoAmbito>("VEHICULO");

  // Los formularios se limpian solo cuando se guardó: con un error se
  // conserva lo escrito para corregirlo.
  useEffect(() => {
    if (!stateCampo.success) return;
    formCampoRef.current?.reset();
    setApartadoCampo("");
    setTipo("TEXTO");
  }, [stateCampo]);
  useEffect(() => {
    if (stateRecuadro.success) formRecuadroRef.current?.reset();
  }, [stateRecuadro]);

  const camposVistos = campos.filter((c) => c.ambito === verAmbito && (!verApartado || aplicaAApartado(c.apartadoSlug, verApartado)));
  const recuadrosVistos = recuadros
    .filter((r) => r.ambito === verAmbito && (!verApartado || aplicaAApartado(r.apartadoSlug, verApartado)))
    .sort((a, b) => a.orden - b.orden);
  const hayAlgo = camposVistos.length > 0 || recuadrosVistos.length > 0;

  const seccionesDeFabrica = seccionesPara(verAmbito);
  const nombreVista = verApartado ? labelDeApartado(verAmbito, verApartado) : "todos los apartados";

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Formato de las fichas por apartado</h2>
        <p className="mb-4 mt-1 text-xs text-gray-500">
          Elige la ficha y el apartado (por ejemplo Auto-Tanques) para ver y cambiar todo lo que se le agregó: campos, recuadros nuevos y su orden. Sirve cuando una norma
          pide algo que el sistema no trae. <b>Lo de fábrica no se toca</b> (alimenta las alertas y los vencimientos); lo que agregues aquí vive aparte y no las afecta.
        </p>
        <div className="mb-4 flex flex-wrap gap-3">
          <label className="text-sm font-medium text-ink">
            Ficha
            <select
              value={verAmbito}
              onChange={(e) => {
                setVerAmbito(e.target.value as CampoAmbito);
                setVerApartado("");
              }}
              className="mt-1 block rounded-md border border-gray-300 px-3 py-1.5 text-sm text-ink"
            >
              {CAMPO_AMBITOS.map((a) => (
                <option key={a} value={a}>
                  {campoAmbitoLabels[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-ink">
            Apartado
            <select
              value={verApartado}
              onChange={(e) => setVerApartado(e.target.value)}
              className="mt-1 block rounded-md border border-gray-300 px-3 py-1.5 text-sm text-ink"
            >
              <option value="">Todos los apartados</option>
              {CAMPO_APARTADOS[verAmbito].map((a) => (
                <option key={a.slug} value={a.slug}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="mb-2 text-xs text-gray-500">
          Recuadros de fábrica de esta ficha (se pueden ampliar con campos, no quitar): {seccionesDeFabrica.map((s) => s.label).join(" · ")}.
        </p>

        {!hayAlgo ? (
          <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-ink">
            Todavía no se ha agregado nada a {nombreVista}.
          </p>
        ) : (
          <div className="space-y-5">
            {seccionesDeFabrica.map((seccion) => {
              const deLaSeccion = camposVistos.filter((c) => c.seccion === seccion.id).sort((a, b) => a.orden - b.orden);
              if (deLaSeccion.length === 0) return null;
              return (
                <div key={seccion.id}>
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{seccion.label}</p>
                  <ul className="space-y-2">
                    {deLaSeccion.map((campo, i) => (
                      <FilaCampo key={campo.id} campo={campo} esPrimero={i === 0} esUltimo={i === deLaSeccion.length - 1} recuadros={recuadros} />
                    ))}
                  </ul>
                </div>
              );
            })}
            {recuadrosVistos.map((recuadro, ri) => {
              const deLaSeccion = camposVistos.filter((c) => c.seccion === seccionDePropia(recuadro.id)).sort((a, b) => a.orden - b.orden);
              return (
                <div key={recuadro.id} className="rounded-md border-l-4 border-l-orange-400 bg-orange-50/50 p-3">
                  <CabeceraRecuadro recuadro={recuadro} esPrimero={ri === 0} esUltimo={ri === recuadrosVistos.length - 1} />
                  {deLaSeccion.length === 0 ? (
                    <p className="text-xs text-gray-500">Este recuadro todavía no tiene campos. Agrégalos abajo, en «Agregar un campo».</p>
                  ) : (
                    <ul className="space-y-2">
                      {deLaSeccion.map((campo, i) => (
                        <FilaCampo key={campo.id} campo={campo} esPrimero={i === 0} esUltimo={i === deLaSeccion.length - 1} recuadros={recuadros} />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Crear un recuadro nuevo</h2>
        <p className="mb-4 mt-1 text-xs text-gray-500">
          Una sección completa nueva en la ficha de un apartado (por ejemplo «Dictamen de la norma nueva»). Sale al final de la ficha, con su propio título; después le agregas campos.
        </p>
        <form ref={formRecuadroRef} action={accionRecuadro} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-ink">
              Ficha
              <select
                name="ambito"
                value={ambitoRecuadro}
                onChange={(e) => setAmbitoRecuadro(e.target.value as CampoAmbito)}
                className={`mt-1 ${inputClass}`}
              >
                {CAMPO_AMBITOS.map((a) => (
                  <option key={a} value={a}>
                    {campoAmbitoLabels[a]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-ink">
              Se ve en
              <select name="apartadoSlug" defaultValue="" className={`mt-1 ${inputClass}`}>
                <option value="">Todos los apartados</option>
                {CAMPO_APARTADOS[ambitoRecuadro].map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium text-ink">
              Título del recuadro
              <input name="titulo" required placeholder="Ej. Requisitos de la NOM nueva" className={`mt-1 ${inputClass}`} />
            </label>
          </div>
          <FormMessage state={stateRecuadro} />
          <SubmitButton texto="Crear recuadro" pendiente="Creando..." />
        </form>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Agregar un campo</h2>
        <p className="mb-4 mt-1 text-xs text-gray-500">
          Un dato más en la ficha, en el recuadro que elijas (de fábrica o uno nuevo) y solo en el apartado que elijas. No modifica los campos que ya existen ni afecta las alertas.
        </p>

        <form ref={formCampoRef} action={accionCampo} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm font-medium text-ink">
              Ficha
              <select
                name="ambito"
                value={ambito}
                onChange={(e) => {
                  setAmbito(e.target.value as CampoAmbito);
                  setApartadoCampo("");
                }}
                className={`mt-1 ${inputClass}`}
              >
                {CAMPO_AMBITOS.map((a) => (
                  <option key={a} value={a}>
                    {campoAmbitoLabels[a]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-ink">
              Se ve en
              <select
                name="apartadoSlug"
                value={apartadoCampo}
                onChange={(e) => setApartadoCampo(e.target.value)}
                className={`mt-1 ${inputClass}`}
              >
                <option value="">Todos los apartados</option>
                {CAMPO_APARTADOS[ambito].map((a) => (
                  <option key={a.slug} value={a.slug}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-ink">
              Recuadro
              <select name="seccion" required defaultValue="" className={`mt-1 ${inputClass}`}>
                <option value="" disabled>
                  Selecciona...
                </option>
                {opcionesDeRecuadro(ambito, apartadoCampo || null, recuadros).map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-ink">
              Nombre del campo
              <input name="etiqueta" required placeholder="Ej. Número de póliza ambiental" className={`mt-1 ${inputClass}`} />
            </label>

            <label className="text-sm font-medium text-ink">
              Tipo
              <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as CampoTipo)} className={`mt-1 ${inputClass}`}>
                {CAMPO_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {campoTipoLabels[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {tipo === "LISTA" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="cf-opciones">
                Opciones del listado
              </label>
              <textarea
                id="cf-opciones"
                name="opciones"
                required
                rows={4}
                placeholder={"Escribe una opción por línea, por ejemplo:\nExcelente\nBuena\nMala"}
                className={inputClass}
              />
              <p className="mt-1 text-xs text-gray-500">Cada línea será una opción del listado. Se quitan líneas vacías y repetidas.</p>
            </div>
          )}

          <FormMessage state={stateCampo} />
          <SubmitButton texto="Agregar campo" pendiente="Agregando..." />
        </form>
      </div>
    </div>
  );
}
