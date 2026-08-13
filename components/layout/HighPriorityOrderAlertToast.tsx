"use client";

import { useEffect, useState } from "react";
import { consumePendingHighPriorityOrderAlert } from "@/actions/user-actions";

const TRES_MINUTOS_MS = 3 * 60 * 1000;

// Mismo patrón que InProgressAlertToast: al montarse (una vez por inicio de
// sesión) pregunta si loginAction dejó un aviso pendiente de órdenes de
// prioridad ALTA (unidad en mal estado, ver lib/login-alerts.ts) y, si sí, lo
// muestra durante 3 minutos (posicionamiento fijo a cargo de
// LoginAlertToasts, que lo apila con los demás avisos de inicio de sesión).
export function HighPriorityOrderAlertToast() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    consumePendingHighPriorityOrderAlert().then((n) => {
      if (!cancelado && n && n > 0) setCount(n);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (count === null) return;
    const timer = setTimeout(() => setCount(null), TRES_MINUTOS_MS);
    return () => clearTimeout(timer);
  }, [count]);

  if (count === null) return null;

  return (
    <div className="w-80 rounded-lg border border-orange-400 bg-orange-50 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-ink">
          Hay <strong>{count}</strong> orden{count === 1 ? "" : "es"} de prioridad{" "}
          <strong className="text-orange-700">alta</strong> (unidad en mal estado) sin resolver en tus
          ciudades.
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
    </div>
  );
}
