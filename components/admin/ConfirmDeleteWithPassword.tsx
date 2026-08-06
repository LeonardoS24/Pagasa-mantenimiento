"use client";

import { useEffect, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ActionState } from "@/actions/user-actions";
import { describeImpact, impactTotal, type DeleteImpact } from "@/lib/delete-impact";

const initialState: ActionState = {};

function BotonConfirmar({ pideContrasena }: { pideContrasena: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-60"
    >
      {pending ? "Eliminando..." : pideContrasena ? "Confirmar y eliminar" : "Sí, eliminar"}
    </button>
  );
}

// Confirmación de borrado en dos tiempos: primero se consulta qué contiene lo
// que se va a eliminar y se muestra el conteo real, y solo entonces se pide la
// contraseña. El conteo se pide al abrir la confirmación y no al pintar la
// lista, porque son varias consultas por cada fila.
export function ConfirmDeleteWithPassword({
  nombre,
  tipo,
  action,
  cargarImpacto,
  className,
  children,
}: {
  nombre: string;
  tipo: "ciudad" | "apartado" | "unidad" | "equipo";
  action: (prevState: ActionState, formData: FormData) => Promise<ActionState>;
  cargarImpacto: () => Promise<{ impacto: DeleteImpact; pideContrasena: boolean }>;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, formAction] = useFormState(action, initialState);
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<{ impacto: DeleteImpact; pideContrasena: boolean } | null>(null);
  const [cargando, startTransition] = useTransition();

  // Al borrarse la fila, React puede reutilizar el estado de este componente
  // para la fila que ocupa su lugar, y esa hereda el conteo de la anterior:
  // se veía "Vas a eliminar Apartado vacío ... 3 unidades", que era de otro.
  // Cerrar en cuanto la acción tiene éxito evita mostrar cifras ajenas.
  useEffect(() => {
    if (state.success) {
      setAbierto(false);
      setDatos(null);
    }
  }, [state.success]);

  function abrir() {
    setAbierto(true);
    startTransition(async () => {
      setDatos(await cargarImpacto());
    });
  }

  if (!abierto) {
    return (
      <button type="button" className={className} onClick={abrir}>
        {children}
      </button>
    );
  }

  if (cargando || !datos) {
    return <span className="text-xs text-ink">Revisando qué contiene...</span>;
  }

  const { impacto, pideContrasena } = datos;

  return (
    <form action={formAction} className="flex flex-col items-start gap-2 text-left">
      <p className="text-xs text-ink">
        Vas a eliminar{" "}
        {tipo === "ciudad"
          ? "la ciudad"
          : tipo === "apartado"
            ? "el apartado"
            : tipo === "equipo"
              ? "el equipo"
              : "la unidad"}{" "}
        <span className="font-semibold">“{nombre}”</span>.
      </p>

      <p
        className={`rounded-md border px-2 py-1 text-xs ${
          pideContrasena
            ? "border-orange-300 bg-orange-50 text-orange-900"
            : "border-gray-200 bg-gray-50 text-ink"
        }`}
      >
        {impactTotal(impacto) === 0
          ? `${
              tipo === "unidad" || tipo === "equipo"
                ? "No tiene bitácoras ni documentos registrados."
                : "No contiene unidades, bitácoras ni documentos."
            }${
              impacto.apartados > 0 ? ` Se eliminarán ${impacto.apartados} sub-apartado(s) vacío(s).` : ""
            }`
          : `Se eliminará también: ${describeImpact(impacto)}. No se puede deshacer.`}
      </p>

      {pideContrasena && (
        <label className="flex flex-col gap-1 text-xs text-ink">
          Escribe tu contraseña para confirmar
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </label>
      )}

      <div className="flex gap-2">
        <BotonConfirmar pideContrasena={pideContrasena} />
        <button
          type="button"
          onClick={() => {
            setAbierto(false);
            setDatos(null);
          }}
          className="shrink-0 rounded-md border border-gray-300 px-3 py-1 text-xs text-ink hover:bg-gray-50"
        >
          Cancelar
        </button>
      </div>

      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
