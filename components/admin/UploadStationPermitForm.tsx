"use client";

import { useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { uploadStationPermit } from "@/actions/document-actions";
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
      {pending ? "Subiendo..." : "Subir permiso"}
    </button>
  );
}

// A diferencia de UploadVehicleDocumentForm (solo archivo), este también
// pide la fecha en que se realizó/emitió el permiso (ver
// actions/document-actions.ts: uploadStationPermit).
export function UploadStationPermitForm({ vehicleRecordId }: { vehicleRecordId: string }) {
  const action = uploadStationPermit.bind(null, vehicleRecordId);
  const [state, formAction] = useFormState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await formAction(formData);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-gray-300 bg-white p-4"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-ink" htmlFor="fechaPermiso">
          Fecha del permiso
        </label>
        <input
          id="fechaPermiso"
          name="fecha"
          type="date"
          required
          className="rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
      </div>
      <input
        type="file"
        name="file"
        accept="application/pdf,image/*"
        required
        className="text-sm text-ink file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink hover:file:bg-gray-200"
      />
      <SubmitButton />
      <FormMessage state={state} />
    </form>
  );
}
