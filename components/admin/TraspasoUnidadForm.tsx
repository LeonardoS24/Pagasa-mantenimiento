"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/user-actions";

const initialState: ActionState = {};

function BotonConfirmar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Cambiando de ciudad..." : "Confirmar cambio de ciudad"}
    </button>
  );
}

// Cambio de ciudad de una unidad de distribución (solo ADMIN, ver
// actions/traspaso-actions.ts). Primero se elige la ciudad y se lee qué va a
// pasar; la contraseña se pide al confirmar, como en los borrados.
export function TraspasoUnidadForm({
  nombre,
  ciudadActual,
  ciudades,
  par,
  action,
}: {
  nombre: string;
  ciudadActual: string;
  ciudades: { id: string; name: string }[];
  par: { numeroEconomico: string; apartado: string } | null;
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useFormState(action, initialState);
  const [abierto, setAbierto] = useState(false);
  const [destinoId, setDestinoId] = useState("");
  const destino = ciudades.find((c) => c.id === destinoId);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-white"
      >
        Cambiar de ciudad
      </button>
    );
  }

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-3 text-sm text-ink">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Ciudad a la que pasa</span>
        <select
          name="destinoCityId"
          required
          value={destinoId}
          onChange={(e) => setDestinoId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none"
        >
          <option value="">Elige una ciudad…</option>
          {ciudades.map((ciudad) => (
            <option key={ciudad.id} value={ciudad.id}>
              {ciudad.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Motivo (opcional)</span>
        <textarea
          name="motivo"
          rows={2}
          maxLength={500}
          placeholder="Por qué cambia de ciudad..."
          className="rounded-md border border-gray-300 p-2 focus:border-primary focus:outline-none"
        />
      </label>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
        <p className="mb-1 font-semibold">Qué pasa al confirmar</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            “{nombre}” deja {ciudadActual}
            {destino ? ` y pasa a ${destino.name}` : " y pasa a la ciudad elegida"}, al apartado del mismo
            tipo.
          </li>
          {par && (
            <li>
              También pasa “{par.numeroEconomico}” ({par.apartado}): es el mismo camión y se mueve junto.
            </li>
          )}
          <li>Se conservan su ficha, bitácoras y documentos. Nada se borra.</li>
          <li>Sus alertas y vencimientos dejan de salir en {ciudadActual} y salen en la ciudad nueva.</li>
          <li>
            Los códigos QR ya impresos siguen funcionando: abren la ficha en su ciudad nueva (quien los escanee
            necesita acceso a ella).
          </li>
          <li>Quien solo tenga acceso a {ciudadActual} deja de verla.</li>
        </ul>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Escribe tu contraseña para confirmar</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none"
        />
      </label>

      {state.error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <BotonConfirmar />
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setDestinoId("");
          }}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-ink hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
