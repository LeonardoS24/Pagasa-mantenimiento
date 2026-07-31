"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

// No usa window.confirm(): algunos navegadores suprimen los diálogos nativos
// después de mostrarse varias veces en la misma página (p. ej. la casilla
// "Evitar que esta página cree más cuadros de diálogo"), lo que bloquea el
// envío del formulario en silencio sin avisar al usuario. Esta confirmación
// en pantalla no depende de eso.
export function ConfirmSubmitButton({
  children,
  confirmMessage,
  confirmLabel = "Sí, eliminar",
  pendingLabel = "Eliminando...",
  className,
}: {
  children: React.ReactNode;
  confirmMessage: string;
  confirmLabel?: string;
  pendingLabel?: string;
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const { pending } = useFormStatus();

  if (confirming) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        <span className="text-xs text-ink">{confirmMessage}</span>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-md bg-accent px-2 py-1 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-60"
        >
          {pending ? pendingLabel : confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="shrink-0 rounded-md border border-gray-300 px-2 py-1 text-xs text-ink hover:bg-gray-50"
        >
          Cancelar
        </button>
      </span>
    );
  }

  return (
    <button type="button" className={className} onClick={() => setConfirming(true)}>
      {children}
    </button>
  );
}
