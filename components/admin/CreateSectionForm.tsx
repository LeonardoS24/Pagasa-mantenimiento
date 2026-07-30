"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createSection } from "@/actions/section-actions";
import type { ActionState } from "@/actions/user-actions";

const initialState: ActionState = {};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="whitespace-nowrap rounded-md border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary hover:text-white disabled:opacity-60"
    >
      {pending ? "Agregando..." : label}
    </button>
  );
}

export function CreateSectionForm({
  cityId,
  parentId,
  placeholder,
  buttonLabel,
}: {
  cityId: string;
  parentId: string | null;
  placeholder: string;
  buttonLabel: string;
}) {
  const [state, formAction] = useFormState(createSection, initialState);

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="cityId" value={cityId} />
        {parentId && <input type="hidden" name="parentId" value={parentId} />}
        <input
          name="name"
          placeholder={placeholder}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <SubmitButton label={buttonLabel} />
      </form>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </div>
  );
}
