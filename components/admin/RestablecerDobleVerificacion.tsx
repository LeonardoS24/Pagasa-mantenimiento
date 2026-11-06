"use client";

import { useState, useTransition } from "react";
import { restablecerDobleVerificacion } from "@/actions/doble-verificacion-actions";

// Para quien perdió el teléfono y sus códigos de recuperación. Confirma con la
// contraseña del administrador; la persona la vuelve a activar al entrar.
export function RestablecerDobleVerificacion({ userId, username }: { userId: string; username: string }) {
  const [password, setPassword] = useState("");
  const [respuesta, setRespuesta] = useState<{ error?: string; mensaje?: string } | null>(null);
  const [pendiente, empezar] = useTransition();

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">
        {username} tiene la doble verificación activa. Si perdió el teléfono y sus códigos de recuperación, restablécela: la cuenta vuelve a entrar solo con contraseña y la persona
        puede activarla de nuevo.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-64">
          <input
            type="password"
            id={`restablecer-2fa-${userId}`}
            name="password"
            autoComplete="current-password"
            placeholder="Tu contraseña para confirmar"
            aria-label="Tu contraseña para confirmar"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink"
          />
        </div>
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            empezar(async () => {
              const r = await restablecerDobleVerificacion(userId, password);
              setRespuesta(r);
              if (!r.error) setPassword("");
            })
          }
          className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
        >
          {pendiente ? "Restableciendo..." : "Restablecer la doble verificación"}
        </button>
      </div>
      {respuesta?.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{respuesta.error}</p>}
      {respuesta?.mensaje && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{respuesta.mensaje}</p>}
    </div>
  );
}
