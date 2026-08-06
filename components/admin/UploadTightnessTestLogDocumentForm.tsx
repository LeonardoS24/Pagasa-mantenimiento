"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { uploadTightnessTestLogDocument } from "@/actions/document-actions";
import type { ActionState } from "@/actions/user-actions";

const initialState: ActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Subiendo..." : "Subir archivo"}
    </button>
  );
}

export function UploadTightnessTestLogDocumentForm({
  tightnessTestLogId,
}: {
  tightnessTestLogId: string;
}) {
  const action = uploadTightnessTestLogDocument.bind(null, tightnessTestLogId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div>
      <form
        ref={formRef}
        action={async (formData) => {
          await formAction(formData);
          formRef.current?.reset();
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <input
          type="file"
          name="file"
          accept="application/pdf,image/*"
          required
          className="text-xs text-ink file:mr-2 file:rounded-md file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-medium file:text-ink hover:file:bg-gray-200"
        />
        <SubmitButton />
      </form>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-green-700">{state.success}</p>}
    </div>
  );
}
