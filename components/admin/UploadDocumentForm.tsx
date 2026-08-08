"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { uploadDocument } from "@/actions/document-actions";
import type { ActionState } from "@/actions/user-actions";
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
      {pending ? "Subiendo..." : "Subir archivo"}
    </button>
  );
}

// allowOfficeDocs: solo "Programa de mantenimiento" (ver
// actions/document-actions.ts) deja subir Word/Excel/PowerPoint/CSV/TXT
// además de PDF e imagen; el resto de apartados con documentos se queda
// solo con PDF/imagen.
const OFFICE_ACCEPT =
  ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/csv,text/plain";

export function UploadDocumentForm({
  sectionId,
  allowOfficeDocs = false,
}: {
  sectionId: string;
  allowOfficeDocs?: boolean;
}) {
  const action = uploadDocument.bind(null, sectionId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-gray-300 bg-white p-4"
    >
      <input
        type="file"
        name="file"
        accept={allowOfficeDocs ? `application/pdf,image/*,${OFFICE_ACCEPT}` : "application/pdf,image/*"}
        required
        className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
      />
      <SubmitButton />
      <FormMessage state={state} />
    </form>
  );
}
