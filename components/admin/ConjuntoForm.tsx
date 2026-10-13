"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveConjunto } from "@/actions/conjunto-actions";
import type { ActionState } from "@/actions/user-actions";
import { MAX_SEMIRREMOLQUES_POR_CONJUNTO } from "@/lib/kino-sections";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

type Opcion = { id: string; numeroEconomico: string; activo: boolean };

function Guardar({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

// Alta o edición de un conjunto (tractocamión + hasta 2 semirremolques).
// Antes de guardar revisa lo elegido y, si un semirremolque ya está en otro
// conjunto, pide confirmar que se mueva; el servidor vuelve a validar todo
// (ver actions/conjunto-actions.ts).
export function ConjuntoForm({
  cityId,
  conjunto,
  tractocamiones,
  semirremolques,
  conjuntoDeSemirremolque,
  onDone,
}: {
  cityId: string;
  conjunto?: { id: string; nombre: string; observaciones: string | null; tractocamionId: string | null; semirremolqueIds: string[] };
  tractocamiones: Opcion[];
  semirremolques: Opcion[];
  // id del semirremolque -> nombre del conjunto donde está hoy.
  conjuntoDeSemirremolque: Record<string, string>;
  onDone?: () => void;
}) {
  const action = saveConjunto.bind(null, cityId, conjunto?.id ?? null);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.success) {
      if (!conjunto) formRef.current?.reset();
      onDone?.();
    }
  }, [state.success, conjunto, onDone]);

  function revisarAntesDeGuardar(event: React.FormEvent<HTMLFormElement>) {
    setError(null);
    const datos = new FormData(event.currentTarget);
    const nombre = String(datos.get("nombre") ?? "").trim();
    const tracto = String(datos.get("tractocamionId") ?? "");
    const semis = datos.getAll("semirremolqueId").map(String).filter(Boolean);
    let problema: string | null = null;
    if (!nombre) problema = "Escribe el nombre del conjunto.";
    else if (!tracto && semis.length === 0) problema = "Elige al menos el tractocamión o un semirremolque.";
    else if (new Set(semis).size !== semis.length) problema = "Elegiste el mismo semirremolque dos veces.";
    if (problema) {
      event.preventDefault();
      setError(problema);
      return;
    }
    const movidos = semis
      .filter((id) => conjuntoDeSemirremolque[id] && conjuntoDeSemirremolque[id] !== conjunto?.nombre)
      .map((id) => `${semirremolques.find((s) => s.id === id)?.numeroEconomico} está en "${conjuntoDeSemirremolque[id]}"`);
    if (movidos.length && !window.confirm(`${movidos.join("\n")}\n\nSe moverá(n) a este conjunto. ¿Continuar?`)) {
      event.preventDefault();
    }
  }

  const etiqueta = (o: Opcion, conjuntoActual?: string) =>
    `${o.numeroEconomico}${!o.activo ? " (dada de baja)" : ""}${conjuntoActual && conjuntoActual !== conjunto?.nombre ? ` — en ${conjuntoActual}` : ""}`;

  return (
    <form ref={formRef} action={formAction} onSubmit={revisarAntesDeGuardar} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor={`nombre-${conjunto?.id ?? "nuevo"}`}>
            Nombre (dictamen)<span className="ml-0.5 text-accent">*</span>
          </label>
          <input
            id={`nombre-${conjunto?.id ?? "nuevo"}`}
            name="nombre"
            required
            maxLength={80}
            defaultValue={conjunto?.nombre ?? ""}
            placeholder="Dictamen 05"
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor={`tracto-${conjunto?.id ?? "nuevo"}`}>
            Tractocamión
          </label>
          <select id={`tracto-${conjunto?.id ?? "nuevo"}`} name="tractocamionId" defaultValue={conjunto?.tractocamionId ?? ""} className={inputClass}>
            <option value="">Sin tractocamión</option>
            {tractocamiones.map((t) => (
              <option key={t.id} value={t.id}>
                {etiqueta(t)}
              </option>
            ))}
          </select>
        </div>
        {Array.from({ length: MAX_SEMIRREMOLQUES_POR_CONJUNTO }, (_, i) => (
          <div key={i}>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor={`semi${i}-${conjunto?.id ?? "nuevo"}`}>
              Semirremolque {i + 1}
            </label>
            <select
              id={`semi${i}-${conjunto?.id ?? "nuevo"}`}
              name="semirremolqueId"
              defaultValue={conjunto?.semirremolqueIds[i] ?? ""}
              className={inputClass}
            >
              <option value="">—</option>
              {semirremolques.map((s) => (
                <option key={s.id} value={s.id}>
                  {etiqueta(s, conjuntoDeSemirremolque[s.id])}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor={`obs-${conjunto?.id ?? "nuevo"}`}>
          Observaciones
        </label>
        <input
          id={`obs-${conjunto?.id ?? "nuevo"}`}
          name="observaciones"
          maxLength={500}
          defaultValue={conjunto?.observaciones ?? ""}
          className={inputClass}
        />
      </div>
      {error && <p className="text-sm text-accent">{error}</p>}
      <FormMessage state={state} />
      <Guardar label={conjunto ? "Guardar cambios" : "Crear conjunto"} />
    </form>
  );
}
