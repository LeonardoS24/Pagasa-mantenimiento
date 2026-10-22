"use client";

import { useEffect, useState } from "react";
import { INACTIVIDAD_MS } from "@/lib/sesion-vigencia";

// Cierra la sesión a los 20 minutos sin actividad, con aviso un par de
// minutos antes. El servidor también lo aplica por su cuenta (middleware y
// getSession), esto es para que una pantalla olvidada abierta se cierre sola y
// para que usar la pantalla (escribir en un formulario largo, por ejemplo) no
// deje vencer la sesión aunque no haya navegación.
const AVISO_ANTES_MS = 3 * 60 * 1000;
const LATIDO_MS = 60 * 1000;
const CLAVE_ACTIVIDAD = "pagasa:ultima-actividad";
const SALIDA = "/sesion-invalida?motivo=inactividad";

function actividadDeOtraPestana(): number {
  try {
    return Number(localStorage.getItem(CLAVE_ACTIVIDAD)) || 0;
  } catch {
    return 0;
  }
}

export function InactividadGuard() {
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);

  useEffect(() => {
    let ultimaActividad = Date.now();
    let ultimoLatido = Date.now();
    let ultimoGuardado = 0;
    let saliendo = false;

    const salir = () => {
      if (saliendo) return;
      saliendo = true;
      window.location.href = SALIDA;
    };

    const latido = async () => {
      ultimoLatido = Date.now();
      try {
        // redirect "manual": si el servidor ya venció la sesión, el middleware
        // contesta con un redirect al login y aquí llega como "opaqueredirect".
        const r = await fetch("/api/sesion/ping", {
          cache: "no-store",
          redirect: "manual",
          credentials: "same-origin",
        });
        if (r.type === "opaqueredirect" || r.status === 401) salir();
      } catch {
        // Sin red: no se cierra por eso, el servidor decide cuando haya red.
      }
    };

    const alHaberActividad = () => {
      const ahora = Date.now();
      ultimaActividad = ahora;
      // Las demás pestañas del sistema se enteran para no cerrarse por error.
      if (ahora - ultimoGuardado > 10_000) {
        ultimoGuardado = ahora;
        try {
          localStorage.setItem(CLAVE_ACTIVIDAD, String(ahora));
        } catch {
          // localStorage puede estar bloqueado; no pasa nada.
        }
      }
      if (ahora - ultimoLatido >= LATIDO_MS) void latido();
    };

    const revisar = () => {
      const ultima = Math.max(ultimaActividad, actividadDeOtraPestana());
      const inactivo = Date.now() - ultima;
      if (inactivo >= INACTIVIDAD_MS) {
        salir();
        return;
      }
      const faltan = INACTIVIDAD_MS - inactivo;
      setSegundosRestantes(faltan <= AVISO_ANTES_MS ? Math.ceil(faltan / 1000) : null);
    };

    const eventos = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel"] as const;
    for (const e of eventos) window.addEventListener(e, alHaberActividad, { passive: true });
    document.addEventListener("visibilitychange", revisar);
    const reloj = window.setInterval(revisar, 5000);
    // Una pestaña que despierta después de mucho rato debe cerrarse de
    // inmediato si ya venció, sin esperar al reloj.
    revisar();

    return () => {
      for (const e of eventos) window.removeEventListener(e, alHaberActividad);
      document.removeEventListener("visibilitychange", revisar);
      window.clearInterval(reloj);
    };
  }, []);

  if (segundosRestantes === null) return null;

  const minutos = Math.floor(segundosRestantes / 60);
  const segundos = String(segundosRestantes % 60).padStart(2, "0");

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border border-orange-300 bg-orange-50 p-4 shadow-lg print:hidden"
    >
      <p className="text-sm font-semibold text-orange-900">Tu sesión está por cerrarse</p>
      <p className="mt-1 text-sm text-orange-800">
        Por seguridad se cierra tras {Math.round(INACTIVIDAD_MS / 60000)} minutos sin actividad. Se cerrará en{" "}
        <span className="font-mono font-semibold">
          {minutos}:{segundos}
        </span>
        .
      </p>
      <p className="mt-2 text-xs text-orange-700">Mueve el ratón o toca la pantalla para seguir conectado.</p>
    </div>
  );
}
