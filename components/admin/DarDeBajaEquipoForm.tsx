"use client";

import { useState } from "react";
import { darDeBajaEquipo } from "@/actions/equipo-actions";
import { ConfirmSubmitButton } from "./ConfirmSubmitButton";
import { FormMessage } from "./FormMessage";
import type { ActionState } from "@/actions/user-actions";

type Candidato = { id: string; nombre: string; codigo: string | null };

// Dar de baja un equipo directo, sin pasar por la bitácora: pide el motivo
// (obligatorio) y, si ya se sabe, por cuál equipo existente se sustituyó
// (ver darDeBajaEquipo en actions/equipo-actions.ts). Distinto del mecanismo
// automático al registrar un mantenimiento tipo "Cambio" (ver
// CreateEquipmentLogForm), que siempre crea un equipo nuevo en blanco: aquí
// se elige uno que ya existe en el sistema.
export function DarDeBajaEquipoForm({
  equipoId,
  nombre,
  candidatos,
}: {
  equipoId: string;
  nombre: string;
  candidatos: Candidato[];
}) {
  const [state, setState] = useState<ActionState>({});
  const action = darDeBajaEquipo.bind(null, equipoId);

  return (
    <form
      action={async (formData) => {
        const result = await action({}, formData);
        setState(result);
      }}
    >
      <ConfirmSubmitButton
        confirmMessage={`¿Dar de baja el equipo "${nombre}"? Seguirá apareciendo en el sistema marcado como dado de baja.`}
        confirmLabel="Sí, dar de baja"
        pendingLabel="Guardando..."
        className="rounded-md border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600"
        extraContent={
          <div className="space-y-3">
            <div>
              <label htmlFor="motivo" className="mb-1 block text-sm font-medium text-ink">
                Motivo de la baja
              </label>
              <textarea
                id="motivo"
                name="motivo"
                required
                rows={3}
                maxLength={500}
                className="w-full rounded-md border border-gray-300 p-2 text-sm focus:border-primary focus:outline-none"
                placeholder="Describe por qué se da de baja este equipo..."
              />
            </div>
            {candidatos.length > 0 && (
              <div>
                <label htmlFor="sustituidoPorId" className="mb-1 block text-sm font-medium text-ink">
                  ¿Por cuál equipo se sustituyó? (opcional)
                </label>
                <select
                  id="sustituidoPorId"
                  name="sustituidoPorId"
                  defaultValue=""
                  className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="">No se sabe todavía</option>
                  {candidatos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.codigo ? `${c.codigo} — ${c.nombre}` : c.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        }
      >
        Dar de baja
      </ConfirmSubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
