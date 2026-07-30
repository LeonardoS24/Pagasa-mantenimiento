"use client";

import { useFormState, useFormStatus } from "react-dom";
import { updateSection } from "@/actions/section-actions";
import type { ActionState } from "@/actions/user-actions";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Guardar"}
    </button>
  );
}

export function RenameSectionForm({
  sectionId,
  defaultName,
}: {
  sectionId: string;
  defaultName: string;
}) {
  const action = updateSection.bind(null, sectionId);
  const [state, formAction] = useFormState(action, initialState);

  return (
    <div>
      <form action={formAction} className="flex items-center gap-2">
        <input
          name="name"
          defaultValue={defaultName}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <SubmitButton />
      </form>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
