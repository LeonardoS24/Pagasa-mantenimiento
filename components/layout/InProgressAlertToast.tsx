"use client";

import { useEffect, useState, useTransition } from "react";
import { consumePendingInProgressAlert, disableInProgressAlerts } from "@/actions/user-actions";

const CINCO_MINUTOS_MS = 5 * 60 * 1000;

// Al montarse (una vez por inicio de sesión: este layout no se vuelve a
// montar en navegaciones dentro de la app, ver app/(protected)/layout.tsx),
// pregunta si loginAction dejó un aviso pendiente de mantenimientos "En
// proceso" y, si sí, lo muestra arriba a la derecha durante 5 minutos.
export function InProgressAlertToast() {
  const [count, setCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelado = false;
    consumePendingInProgressAlert().then((n) => {
      if (!cancelado && n && n > 0) setCount(n);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (count === null) return;
    const timer = setTimeout(() => setCount(null), CINCO_MINUTOS_MS);
    return () => clearTimeout(timer);
  }, [count]);

  if (count === null) return null;

  return (
    <div className="fixed right-4 top-20 z-50 w-80 rounded-lg border border-accent/30 bg-white p-4 shadow-lg print:hidden">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-ink">
          Hay <strong>{count}</strong> mantenimiento{count === 1 ? "" : "s"} &quot;En
          proceso&quot; en tus ciudades.
        </p>
        <button
          type="button"
          onClick={() => setCount(null)}
          aria-label="Cerrar aviso"
          className="shrink-0 text-gray-400 hover:text-ink"
        >
          ×
        </button>
      </div>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await disableInProgressAlerts();
            setCount(null);
          })
        }
        className="mt-2 text-xs font-medium text-primary hover:underline disabled:opacity-50"
      >
        Desactivar estos avisos
      </button>
    </div>
  );
}
