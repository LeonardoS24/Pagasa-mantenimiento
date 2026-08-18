"use client";

import { useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import {
  addCustomField,
  renameCustomField,
  moveCustomField,
  deleteCustomField,
} from "@/actions/custom-field-actions";
import type { ActionState } from "@/actions/user-actions";
import {
  CAMPO_AMBITOS,
  CAMPO_TIPOS,
  campoAmbitoLabels,
  campoTipoLabels,
  labelDeSeccion,
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Agregando..." : "Agregar recuadro"}
    </button>
  );
}

function FilaCampo({ campo, esPrimero, esUltimo }: { campo: CampoConUso; esPrimero: boolean; esUltimo: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [editando, setEditando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

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
            const r = await renameCustomField(campo.id, {}, formData);
            setMensaje(r.error ?? null);
            if (!r.error) setEditando(false);
          }}
          className="flex flex-1 flex-wrap items-center gap-2"
        >
          <input
            name="etiqueta"
            defaultValue={campo.etiqueta}
            autoFocus
            className={`max-w-xs ${inputClass}`}
          />
          <button type="submit" className="text-xs font-medium text-primary hover:underline">
            Guardar
          </button>
          <button
            type="button"
            onClick={() => setEditando(false)}
            className="text-xs text-ink hover:underline"
          >
            Cancelar
          </button>
        </form>
      ) : (
        <>
          <span className="flex-1 text-sm text-ink">
            {campo.etiqueta}
            <span className="ml-2 text-xs text-gray-500">
              {campoTipoLabels[campo.tipo]}
              {campo.tipo === "LISTA" && campo.opciones && campo.opciones.length > 0 && (
                <> ({campo.opciones.join(", ")})</>
              )}
              {campo.usos > 0 && ` · capturado en ${campo.usos}`}
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
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="text-xs font-medium text-primary hover:underline"
          >
            Renombrar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={borrar}
            className="text-xs text-red-600 hover:underline disabled:opacity-60"
          >
            Quitar
          </button>
        </>
      )}
      {mensaje && <span className="w-full text-xs text-red-600">{mensaje}</span>}
    </li>
  );
}

// Recuadros extra de las fichas técnicas: se agregan, se renombran, se
// mueven de lugar y se quitan sin tocar los campos de fábrica. Lo capturado
// vive aparte (ver lib/custom-fields.ts), así que agregar o quitar recuadros
// nunca afecta las alertas, el semáforo ni los vencimientos.
export function CustomFieldsPanel({ campos }: { campos: CampoConUso[] }) {
  const [state, formAction] = useFormState(addCustomField, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [ambito, setAmbito] = useState<CampoAmbito>("VEHICULO");
  const [verAmbito, setVerAmbito] = useState<CampoAmbito>("VEHICULO");
  const [tipo, setTipo] = useState<CampoTipo>("TEXTO");

  const secciones = seccionesPara(ambito);
  const delAmbito = campos.filter((c) => c.ambito === verAmbito);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">
          Agregar recuadro a una ficha técnica
        </h2>
        <p className="mb-4 mt-1 text-xs text-gray-500">
          Aparecerá en todas las unidades de ese tipo, en el recuadro que elijas. No modifica los
          campos que ya existen ni afecta las alertas.
        </p>

        <form
          ref={formRef}
          action={async (formData) => {
            await formAction(formData);
            formRef.current?.reset();
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="cf-ambito">
                Ficha
              </label>
              <select
                id="cf-ambito"
                name="ambito"
                value={ambito}
                onChange={(e) => setAmbito(e.target.value as CampoAmbito)}
                className={inputClass}
              >
                {CAMPO_AMBITOS.map((a) => (
                  <option key={a} value={a}>
                    {campoAmbitoLabels[a]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="cf-seccion">
                Recuadro
              </label>
              <select id="cf-seccion" name="seccion" required defaultValue="" className={inputClass}>
                <option value="" disabled>
                  Selecciona...
                </option>
                {secciones.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="cf-etiqueta">
                Nombre del campo
              </label>
              <input
                id="cf-etiqueta"
                name="etiqueta"
                required
                placeholder="Ej. Número de póliza ambiental"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="cf-tipo">
                Tipo
              </label>
              <select
                id="cf-tipo"
                name="tipo"
                value={tipo}
                onChange={(e) => setTipo(e.target.value as CampoTipo)}
                className={inputClass}
              >
                {CAMPO_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {campoTipoLabels[t]}
                  </option>
                ))}
              </select>
            </div>
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
              <p className="mt-1 text-xs text-gray-500">
                Cada línea será una opción del listado. Se quitan líneas vacías y repetidas.
              </p>
            </div>
          )}

          <FormMessage state={state} />
          <SubmitButton />
        </form>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase text-primary-bright">Recuadros agregados</h2>
            <p className="mt-1 text-xs text-gray-500">
              Las flechas cambian el orden en que aparecen dentro de su recuadro.
            </p>
          </div>
          <select
            value={verAmbito}
            onChange={(e) => setVerAmbito(e.target.value as CampoAmbito)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-ink"
          >
            {CAMPO_AMBITOS.map((a) => (
              <option key={a} value={a}>
                {campoAmbitoLabels[a]}
              </option>
            ))}
          </select>
        </div>

        {delAmbito.length === 0 ? (
          <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-ink">
            Todavía no hay recuadros agregados en esta ficha.
          </p>
        ) : (
          <div className="space-y-4">
            {seccionesPara(verAmbito).map((seccion) => {
              const deLaSeccion = delAmbito
                .filter((c) => c.seccion === seccion.id)
                .sort((a, b) => a.orden - b.orden);
              if (deLaSeccion.length === 0) return null;
              return (
                <div key={seccion.id}>
                  <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                    {labelDeSeccion(verAmbito, seccion.id)}
                  </p>
                  <ul className="space-y-2">
                    {deLaSeccion.map((campo, i) => (
                      <FilaCampo
                        key={campo.id}
                        campo={campo}
                        esPrimero={i === 0}
                        esUltimo={i === deLaSeccion.length - 1}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
