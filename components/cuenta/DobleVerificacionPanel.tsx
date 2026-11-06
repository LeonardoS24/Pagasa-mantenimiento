"use client";

import { useFormState, useFormStatus } from "react-dom";
import { confirmarActivacion, iniciarActivacion, quitarDobleVerificacion, type DobleVerificacionState } from "@/actions/doble-verificacion-actions";
import { PasswordInput } from "@/components/PasswordInput";

const inicial: DobleVerificacionState = {};
const campo = "w-full rounded-md border border-gray-300 px-3 py-2 text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function Boton({ texto, enviando, secundario }: { texto: string; enviando: string; secundario?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`w-full rounded-md px-4 py-2 font-medium transition disabled:opacity-60 ${
        secundario ? "border border-red-300 bg-white text-red-700 hover:bg-red-50" : "bg-primary text-white hover:bg-primary-dark"
      }`}
    >
      {pending ? enviando : texto}
    </button>
  );
}

function Mensajes({ state }: { state: DobleVerificacionState }) {
  return (
    <>
      {state.error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>}
      {state.mensaje && <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{state.mensaje}</p>}
    </>
  );
}

// Paso 1: todavía no hay secreto.
export function EmpezarActivacion() {
  const [state, accion] = useFormState(async () => iniciarActivacion(), inicial);
  return (
    <form action={accion} className="space-y-3">
      <Mensajes state={state} />
      <Boton texto="Empezar" enviando="Preparando..." />
    </form>
  );
}

// Paso 2: ya hay secreto; se escanea el QR y se confirma con un código. Al
// confirmar se muestran, una sola vez, los códigos de recuperación.
export function ConfirmarActivacion({ qr, secreto }: { qr: string; secreto: string }) {
  const [state, accion] = useFormState(confirmarActivacion, inicial);
  if (state.codigos) {
    return (
      <div className="space-y-3">
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">Listo: la doble verificación quedó activa.</p>
        <p className="text-sm text-ink">
          <strong>Guarda estos códigos de recuperación en un lugar seguro.</strong> Cada uno sirve una sola vez y es la única forma de entrar si pierdes el teléfono. No se
          volverán a mostrar.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-sm">
          {state.codigos.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <form action="/api/doble-verificacion/listo" method="POST">
          <button type="submit" className="w-full rounded-md bg-primary px-4 py-2 font-medium text-white hover:bg-primary-dark">
            Ya los guardé, continuar
          </button>
        </form>
      </div>
    );
  }
  return (
    <form action={accion} className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-ink">
        <li>Instala en tu teléfono una aplicación de verificación (Google Authenticator, Microsoft Authenticator, Authy...).</li>
        <li>Escanea este código QR con la aplicación.</li>
        <li>Escribe aquí el código de 6 dígitos que muestra.</li>
      </ol>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="Código QR para la aplicación de verificación" width={220} height={220} className="mx-auto rounded-md border border-gray-200" />
      <p className="text-center text-xs text-gray-600">
        ¿No puedes escanear? Escribe esta clave en la aplicación:
        <br />
        <span className="font-mono text-sm text-ink">{secreto.replace(/(.{4})/g, "$1 ").trim()}</span>
      </p>
      <div>
        <label htmlFor="codigo" className="mb-1 block text-sm font-medium text-ink">
          Código de 6 dígitos
        </label>
        <input id="codigo" name="codigo" inputMode="numeric" autoComplete="one-time-code" required placeholder="123456" className={`${campo} text-center text-lg tracking-widest`} />
      </div>
      <Mensajes state={state} />
      <Boton texto="Activar" enviando="Verificando..." />
    </form>
  );
}

// Ya activa: quitarla (si la empresa lo permite).
export function QuitarActivacion() {
  const [state, accion] = useFormState(quitarDobleVerificacion, inicial);
  return (
    <form action={accion} className="space-y-3">
      <p className="text-sm text-ink">Para quitarla escribe tu contraseña y un código vigente de la aplicación.</p>
      <PasswordInput id="password" name="password" autoComplete="current-password" required className={campo} />
      <input name="codigo" inputMode="numeric" autoComplete="one-time-code" required placeholder="Código de 6 dígitos" className={campo} />
      <Mensajes state={state} />
      <Boton texto="Quitar la doble verificación" enviando="Quitando..." secundario />
    </form>
  );
}
