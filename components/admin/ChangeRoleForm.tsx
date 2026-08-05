"use client";

import { useFormState, useFormStatus } from "react-dom";
import { changeUserRole, type ActionState } from "@/actions/user-actions";
import { roleLabels, type Role } from "@/lib/roles";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

// Qué puede hacer cada rol, para no tener que adivinarlo desde el selector.
const roleHints: Record<Role, string> = {
  ADMIN: "Control total: usuarios, ciudades, apartados y eliminar cualquier cosa. Ve todas las ciudades.",
  USUARIO: "Registra unidades, fichas técnicas y bitácoras, y sube archivos. Solo en las ciudades que se le asignen.",
  LECTOR: "Solo consulta y descarga. No puede modificar nada.",
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Cambiar rol"}
    </button>
  );
}

export function ChangeRoleForm({
  userId,
  currentRole,
  esMiCuenta,
}: {
  userId: string;
  currentRole: Role;
  esMiCuenta: boolean;
}) {
  const action = changeUserRole.bind(null, userId);
  const [state, formAction] = useFormState(action, initialState);

  // El servidor lo rechaza igual; aquí se explica antes de intentarlo. La otra
  // salvaguarda (dejar al sistema sin ningún administrador) vive solo en el
  // servidor: quien mira esta pantalla es administrador, así que nunca puede
  // estar viendo a "otro" que sea el único.
  if (esMiCuenta) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-ink">
          Rol actual: <span className="font-semibold">{roleLabels[currentRole]}</span>
        </p>
        <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-ink">
          No puedes cambiar el rol de tu propia cuenta: te dejaría fuera del panel.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="role">
          Rol
        </label>
        <select
          id="role"
          name="role"
          defaultValue={currentRole}
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {(Object.keys(roleLabels) as Role[]).map((role) => (
            <option key={role} value={role}>
              {roleLabels[role]}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-1 text-xs text-gray-500">
        {(Object.keys(roleLabels) as Role[]).map((role) => (
          <li key={role}>
            <span className="font-medium text-ink">{roleLabels[role]}:</span> {roleHints[role]}
          </li>
        ))}
      </ul>

      <FormMessage state={state} />

      <SubmitButton />
    </form>
  );
}
