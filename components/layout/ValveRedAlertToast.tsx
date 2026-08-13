"use client";

import { useEffect, useState } from "react";
import { consumePendingValveRedAlert } from "@/actions/user-actions";

const TRES_MINUTOS_MS = 3 * 60 * 1000;

// Mismo patrón que HighPriorityOrderAlertToast, pero para unidades cuya
// alerta de cambio de válvulas ya está en rojo (falta una semana o menos,
// ver lib/valve-alerts.ts). Las válvulas son la pieza más delicada de todo
// el tanque (mismo criterio que valveAlertBadgeStyles en lib/valve-alerts.ts),
// así que este aviso usa colores sólidos y saturados en vez de los tonos
// pálidos de los demás avisos de inicio de sesión, para que se note mucho
// más y nunca se confunda con uno cualquiera.
export function ValveRedAlertToast() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelado = false;
    consumePendingValveRedAlert().then((n) => {
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
    <div className="w-80 rounded-lg border-2 border-red-800 bg-red-600 p-4 text-white shadow-xl">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold">
          ¡URGENTE! <strong>{count}</strong> unidad{count === 1 ? "" : "es"} con el cambio de válvulas por
          vencer en menos de una semana (o ya vencido) en tus ciudades.
        </p>
        <button
          type="button"
          onClick={() => setCount(null)}
          aria-label="Cerrar aviso"
          className="shrink-0 text-red-100 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}
