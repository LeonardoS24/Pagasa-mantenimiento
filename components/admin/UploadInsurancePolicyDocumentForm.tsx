"use client";

import { useRef } from "react";
import { useFormState } from "react-dom";
import { uploadInsurancePolicyDocument } from "@/actions/document-actions";
import type { ActionState } from "@/actions/user-actions";

const initialState: ActionState = {};

export function UploadInsurancePolicyDocumentForm({
  insurancePolicyLogId,
}: {
  insurancePolicyLogId: string;
}) {
  const action = uploadInsurancePolicyDocument.bind(null, insurancePolicyLogId);
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
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-white hover:bg-primary-dark"
        >
          Subir
        </button>
      </form>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
      {state.success && <p className="mt-1 text-xs text-green-700">{state.success}</p>}
    </div>
  );
}
