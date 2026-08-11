"use client";

import { useState } from "react";

// Input de contraseña con botón para mostrar/ocultar el texto, reutilizado
// en el login y en el panel de administración (cambiar/crear contraseña):
// por default el navegador oculta lo que se escribe y no hay forma de
// revisarlo antes de enviar el formulario.
export function PasswordInput({
  id,
  name,
  required = false,
  autoComplete,
  className,
}: {
  id: string;
  name: string;
  required?: boolean;
  autoComplete?: string;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        required={required}
        autoComplete={autoComplete}
        className={`${className ?? ""} pr-10`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-gray-400 hover:text-ink"
      >
        {visible ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path d="M9.4 5.5A9.6 9.6 0 0 1 12 5c5.5 0 9.5 4.5 10.5 7-.4 1-1 2-1.8 2.9M6.6 6.6C4.4 8 2.9 10 2 12c1 2.5 5 7 10 7 1.6 0 3-.3 4.3-.9" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
