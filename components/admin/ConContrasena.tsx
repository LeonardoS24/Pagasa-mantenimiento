"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Botón que pide la contraseña de quien está en sesión antes de hacer algo
// (agregar, quitar, volver a poner...). Al confirmar llama `accion` con la
// contraseña; si sale bien refresca la página.
export type ResultadoConContrasena = { ok: true; mensaje: string } | { ok: false; error: string };

export function ConContrasena({
  texto,
  confirmar = "Confirmar",
  aviso,
  className,
  peligro = false,
  accion,
  alTerminar,
}: {
  texto: string;
  confirmar?: string;
  aviso?: string;
  className?: string;
  peligro?: boolean;
  accion: (password: string) => Promise<ResultadoConContrasena>;
  alTerminar?: () => void;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const r = await accion(clave);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setAbierto(false);
      setClave("");
      alTerminar?.();
      router.refresh();
    } catch {
      setError("No se pudo guardar. Revisa la conexión e intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className={
          className ??
          (peligro
            ? "rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
            : "rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark")
        }
      >
        {texto}
      </button>
    );
  }

  return (
    <div className={`w-full rounded-md border p-3 ${peligro ? "border-red-200 bg-red-50" : "border-primary/30 bg-primary/5"}`}>
      {aviso && <p className="mb-2 text-xs text-ink">{aviso}</p>}
      <label className="mb-1 block text-xs font-medium text-ink">Tu contraseña para confirmar</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="password"
          autoComplete="current-password"
          value={clave}
          autoFocus
          onChange={(e) => setClave(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (clave && !enviando) void enviar();
            }
          }}
          className="w-56 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          disabled={!clave || enviando}
          onClick={() => void enviar()}
          className={`rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 ${
            peligro ? "bg-red-600 hover:bg-red-700" : "bg-primary hover:bg-primary-dark"
          }`}
        >
          {enviando ? "Guardando..." : confirmar}
        </button>
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setError(null);
            setClave("");
          }}
          className="text-xs text-ink hover:underline"
        >
          Cancelar
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
