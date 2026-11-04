"use client";

import { useEffect } from "react";

// Pantalla que se muestra cuando algo falla al armar una página (ver
// app/error.tsx y app/(protected)/error.tsx). Antes salía la pantalla genérica
// de Next.js, en inglés y sin salida. Aquí se explica en español, se deja
// reintentar y volver al inicio.
//
// No se muestra el texto técnico del error: en producción Next ya lo oculta y
// solo deja un código (`digest`), que es lo que se le pasa a quien da soporte
// para buscar el detalle en logs/servidor-AAAA-MM-DD.log.
export function PantallaDeError({
  error,
  reset,
  conMenu,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  // true cuando se pinta dentro del menú lateral (ya hay barra arriba): el
  // botón de inicio es el mismo, solo cambia el espacio alrededor.
  conMenu: boolean;
}) {
  useEffect(() => {
    // Queda en la consola del navegador por si se revisa ahí.
    console.error(error);
  }, [error]);

  return (
    <div className={conMenu ? "mx-auto max-w-lg py-10" : "mx-auto flex min-h-screen max-w-lg items-center px-4"}>
      <div role="alert" className="w-full rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="mb-2 text-4xl" aria-hidden="true">
          ⚠️
        </p>
        <h1 className="mb-2 text-xl font-semibold text-primary">Algo salió mal</h1>
        <p className="mb-6 text-sm text-ink">
          No se pudo mostrar esta pantalla. No se perdió nada de lo que ya estaba guardado. Intenta de nuevo y, si
          vuelve a pasar, avisa a quien administra el sistema.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
          >
            Intentar de nuevo
          </button>
          {/* <a> y no <Link>: recarga completa, para salir de un estado roto. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/dashboard"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-gray-50"
          >
            Ir al inicio
          </a>
        </div>
        {error.digest && (
          <p className="mt-6 text-xs text-gray-500">
            Código para soporte: <span className="font-mono">{error.digest}</span>
          </p>
        )}
      </div>
    </div>
  );
}
