"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  updateElevatedAccessSchedule,
  disableElevatedAccessSchedule,
  type ActionState,
} from "@/actions/user-actions";
import { DIA_LABELS, type ElevatedAccessSchedule } from "@/lib/elevated-access";
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
      {pending ? "Guardando..." : "Guardar horario"}
    </button>
  );
}

export function ElevatedAccessForm({
  userId,
  schedule,
}: {
  userId: string;
  schedule: ElevatedAccessSchedule | null;
}) {
  const action = updateElevatedAccessSchedule.bind(null, userId);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">
        Dentro de este horario, el usuario puede editar y borrar registros y fichas técnicas como
        si fuera administrador. Nunca podrá borrar ciudades, apartados ni usuarios, ni cambiar
        roles — eso sigue siendo exclusivo del administrador, sin importar la hora.
      </p>

      {schedule ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-accent/30 bg-accent-light/10 px-3 py-2">
          <p className="text-sm text-ink">
            Activo: {schedule.dias.map((d) => DIA_LABELS[d]).join(", ")}, de {schedule.horaInicio} a{" "}
            {schedule.horaFin}.
          </p>
          <form action={disableElevatedAccessSchedule.bind(null, userId)}>
            <button type="submit" className="text-sm text-accent hover:underline">
              Desactivar
            </button>
          </form>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Sin acceso ampliado configurado.</p>
      )}

      <form action={formAction} className="space-y-3">
        <div>
          <p className="mb-1 text-sm font-medium text-ink">Días</p>
          <div className="flex flex-wrap gap-3">
            {DIA_LABELS.map((label, index) => (
              <label key={index} className="flex items-center gap-1.5 text-sm text-ink">
                <input
                  type="checkbox"
                  name="dias"
                  value={index}
                  defaultChecked={schedule?.dias.includes(index) ?? false}
                  className="rounded border-gray-300 text-primary focus:ring-accent"
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="horaInicio">
              Desde
            </label>
            <input
              id="horaInicio"
              name="horaInicio"
              type="time"
              defaultValue={schedule?.horaInicio ?? ""}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="horaFin">
              Hasta
            </label>
            <input
              id="horaFin"
              name="horaFin"
              type="time"
              defaultValue={schedule?.horaFin ?? ""}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
        </div>

        <FormMessage state={state} />

        <SubmitButton />
      </form>
    </div>
  );
}
