"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createPlantAreaMaintenanceLog } from "@/actions/plant-area-actions";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "./FormMessage";

type ChecklistRowState = { hecho: boolean; observacion: string };

function defaultChecklistState(items: readonly string[]): Record<string, ChecklistRowState> {
  return Object.fromEntries(items.map((item) => [item, { hecho: false, observacion: "" }]));
}

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Registrar mantenimiento"}
    </button>
  );
}

export function CreatePlantAreaMaintenanceLogForm({
  sectionId,
  area,
  checklistItems,
}: {
  sectionId: string;
  area: string;
  checklistItems: string[];
}) {
  const action = createPlantAreaMaintenanceLog.bind(null, sectionId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [checklist, setChecklist] = useState<Record<string, ChecklistRowState>>(() =>
    defaultChecklistState(checklistItems)
  );

  const checklistEntries = checklistItems.map((item) => {
    const row = checklist[item] ?? { hecho: false, observacion: "" };
    return { item, hecho: row.hecho, ...(row.observacion.trim() ? { observacion: row.observacion.trim() } : {}) };
  });

  return (
    <details className="rounded-lg border border-dashed border-gray-300 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold text-primary">Registrar mantenimiento</summary>

      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
          setChecklist(defaultChecklistState(checklistItems));
        }}
        className="mt-4 space-y-3"
      >
        <input type="hidden" name="area" value={area} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pa-fecha">
              Fecha
            </label>
            <input id="pa-fecha" name="fecha" type="date" required className={inputClass} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pa-responsable">
              Responsable
            </label>
            <input id="pa-responsable" name="responsable" className={inputClass} />
          </div>
        </div>

        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <input type="hidden" name="checklist" value={JSON.stringify(checklistEntries)} readOnly />
          <p className="mb-2 text-sm font-medium text-ink">Checklist</p>
          <div className="space-y-2">
            {checklistItems.map((item) => {
              const row = checklist[item] ?? { hecho: false, observacion: "" };
              return (
                <div key={item} className="rounded-md bg-white px-3 py-2">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={row.hecho}
                      onChange={(e) =>
                        setChecklist((prev) => ({ ...prev, [item]: { ...row, hecho: e.target.checked } }))
                      }
                    />
                    {item}
                  </label>
                  <input
                    type="text"
                    placeholder="Observación (opcional)"
                    value={row.observacion}
                    onChange={(e) =>
                      setChecklist((prev) => ({ ...prev, [item]: { ...row, observacion: e.target.value } }))
                    }
                    className="mt-1.5 w-full rounded-md border border-gray-300 px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pa-observaciones">
            Observaciones generales
          </label>
          <textarea id="pa-observaciones" name="observaciones" rows={2} className={inputClass} />
        </div>

        <FormMessage state={state} />
        <SubmitButton />
      </form>
    </details>
  );
}
