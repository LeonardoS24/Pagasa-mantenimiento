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
      {pending ? "Pasando el tanque..." : "Confirmar: pasar el tanque"}
    </button>
  );
}

// Pasar el tanque de esta unidad (dada de baja) a otra (solo ADMIN, ver
// actions/traspaso-tanque-actions.ts). Se elige la unidad, se lee qué pasa y
// se confirma con la contraseña.
export function PasarTanqueForm({
  nombre,
  serie,
  registros,
  destinos,
  action,
}: {
  nombre: string;
  serie: string | null;
  registros: string;
  destinos: { id: string; etiqueta: string }[];
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [state, formAction] = useFormState(action, initialState);
  const [abierto, setAbierto] = useState(false);
  const [destinoId, setDestinoId] = useState("");
  const destino = destinos.find((d) => d.id === destinoId);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary hover:text-white"
      >
        Pasar el tanque a otra unidad
      </button>
    );
  }

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-3 text-sm text-ink">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Unidad donde se instaló el tanque</span>
        <select
          name="destinoId"
          required
          value={destinoId}
          onChange={(e) => setDestinoId(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none"
        >
          <option value="">Elige la unidad…</option>
          {destinos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.etiqueta}
            </option>
          ))}
        </select>
        <span className="text-xs text-gray-500">
          Solo salen unidades activas del mismo tipo y sin tanque capturado. Si la unidad nueva no aparece, dala de alta
          primero.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-medium">Motivo (opcional)</span>
        <textarea
          name="motivo"
          rows={2}
          maxLength={500}
          placeholder="Por ejemplo: el camión se dio de baja y el tanque se montó en el nuevo..."
          className="rounded-md border border-gray-300 p-2 focus:border-primary focus:outline-none"
        />
      </label>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs">
        <p className="mb-1 font-semibold">Qué pasa al confirmar</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>
            El tanque{serie ? ` (serie ${serie})` : ""} de “{nombre}” pasa a {destino ? `“${destino.etiqueta}”` : "la unidad elegida"}:
            placa, válvulas, manguera y las fechas de las 5 pruebas. Sus alertas siguen ahí.
          </li>
          <li>Se van con el tanque sus registros ({registros}), con sus documentos y vistos buenos.</li>
          <li>“{nombre}” se queda con sus mantenimientos, extintor, póliza y demás datos del vehículo, y sin datos de tanque.</li>
          <li>En las dos unidades queda anotado de dónde vino y a dónde se fue el tanque. Nada se borra.</li>
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

      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}

      <div className="flex flex-wrap gap-3">
        <BotonConfirmar />
        <button type="button" onClick={() => setAbierto(false)} className="text-sm text-ink hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}
