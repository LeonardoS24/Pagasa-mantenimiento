"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { agregarDocumentosALote } from "@/actions/lote-documentos-actions";
import type { ActionState } from "@/actions/user-actions";
import { FormMessage } from "@/components/admin/FormMessage";
import { TIPOS_LOTE, tipoLoteLabel, type TipoLote } from "@/lib/lote-documentos";
import { OpcionesDeUnidades, type UnidadParaLote } from "./OpcionesDeUnidades";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-2 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

type Renglon = { clave: number; tipo: TipoLote | ""; desde: string; hasta: string; vehicleId: string };

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Agregando..." : "Agregar a la lista"}
    </button>
  );
}

// Varios rangos de páginas de un jalón, cada uno con su tipo y su unidad
// ("1 a 3 → PH10", "4 a 6 → PH9"...). Al agregar un renglón se copia el tipo
// del anterior y empieza en la página que sigue, que es lo normal en un
// escaneo largo de documentos del mismo tipo.
export function AgregarDocumentosForm({
  loteId,
  paginasTotal,
  siguientePagina,
  unidades,
  abierto,
}: {
  loteId: string;
  paginasTotal: number;
  // Primera página que todavía no tiene documento, para arrancar ahí.
  siguientePagina: number;
  unidades: UnidadParaLote[];
  abierto: boolean;
}) {
  const [state, formAction] = useFormState(agregarDocumentosALote.bind(null, loteId), initialState);
  // Estado propio y no la prop directa: si no, el recuadro se cerraba cada
  // vez que la página se volvía a pintar después de agregar.
  const [abiertoAhora, setAbiertoAhora] = useState(abierto);
  const contador = useRef(1);
  const nuevo = (datos: Partial<Renglon> = {}): Renglon => ({
    clave: contador.current++,
    tipo: "",
    desde: "",
    hasta: "",
    vehicleId: "",
    ...datos,
  });
  const [renglones, setRenglones] = useState<Renglon[]>(() => [
    nuevo({ desde: siguientePagina <= paginasTotal ? String(siguientePagina) : "" }),
  ]);

  // Lo agregado ya aparece en la lista de arriba: se vuelve a empezar con
  // un renglón en la página que sigue.
  useEffect(() => {
    if (!state.success) return;
    setRenglones((actuales) => {
      const ultimo = actuales[actuales.length - 1];
      const siguiente = Number(ultimo?.hasta) + 1;
      return [nuevo({ tipo: ultimo?.tipo ?? "", desde: siguiente <= paginasTotal ? String(siguiente) : "" })];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const cambiar = (clave: number, campo: keyof Omit<Renglon, "clave">, valor: string) =>
    setRenglones((actuales) => actuales.map((r) => (r.clave === clave ? { ...r, [campo]: valor } : r)));

  const agregarRenglon = () =>
    setRenglones((actuales) => {
      const ultimo = actuales[actuales.length - 1];
      const siguiente = Number(ultimo?.hasta) + 1;
      return [
        ...actuales,
        nuevo({ tipo: ultimo?.tipo ?? "", desde: siguiente > 1 && siguiente <= paginasTotal ? String(siguiente) : "" }),
      ];
    });

  return (
    <details
      open={abiertoAhora}
      onToggle={(e) => setAbiertoAhora(e.currentTarget.open)}
      className="rounded-lg border border-dashed border-gray-300 bg-white p-4"
    >
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Agregar documentos por rango de páginas
      </summary>
      <p className="mt-2 text-xs text-gray-500">
        Un renglón por documento: de qué página a qué página va, qué es y de qué unidad. Después completa sus datos en
        la lista y guárdalo.
      </p>
      <form action={formAction} className="mt-4 space-y-3">
        <div className="hidden grid-cols-[80px_80px_1fr_1.4fr_32px] gap-2 text-xs font-medium text-ink md:grid">
          <span>Desde pág.</span>
          <span>Hasta pág.</span>
          <span>Tipo de documento</span>
          <span>Unidad (opcional)</span>
          <span />
        </div>
        {renglones.map((r, i) => (
          <div
            key={r.clave}
            className="grid grid-cols-2 gap-2 rounded-md border border-gray-100 p-2 md:grid-cols-[80px_80px_1fr_1.4fr_32px] md:border-0 md:p-0"
          >
            <input
              name="paginaInicio"
              type="number"
              min={1}
              max={paginasTotal}
              required
              aria-label={`Renglón ${i + 1}: desde la página`}
              placeholder="Desde"
              value={r.desde}
              onChange={(e) => cambiar(r.clave, "desde", e.target.value)}
              className={inputClass}
            />
            <input
              name="paginaFin"
              type="number"
              min={1}
              max={paginasTotal}
              required
              aria-label={`Renglón ${i + 1}: hasta la página`}
              placeholder="Hasta"
              value={r.hasta}
              onChange={(e) => cambiar(r.clave, "hasta", e.target.value)}
              className={inputClass}
            />
            <select
              name="tipo"
              required
              aria-label={`Renglón ${i + 1}: tipo de documento`}
              value={r.tipo}
              onChange={(e) => cambiar(r.clave, "tipo", e.target.value)}
              className={`${inputClass} col-span-2 md:col-span-1`}
            >
              <option value="" disabled>
                — Tipo —
              </option>
              {TIPOS_LOTE.map((t) => (
                <option key={t} value={t}>
                  {tipoLoteLabel[t]}
                </option>
              ))}
            </select>
            <select
              name="vehicleId"
              aria-label={`Renglón ${i + 1}: unidad`}
              value={r.vehicleId}
              onChange={(e) => cambiar(r.clave, "vehicleId", e.target.value)}
              className={`${inputClass} col-span-2 md:col-span-1`}
            >
              <option value="">— Unidad —</option>
              <OpcionesDeUnidades unidades={unidades} />
            </select>
            <button
              type="button"
              onClick={() => setRenglones((actuales) => actuales.filter((x) => x.clave !== r.clave))}
              disabled={renglones.length === 1}
              title="Quitar renglón"
              aria-label={`Quitar renglón ${i + 1}`}
              className="col-span-2 rounded-md text-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 md:col-span-1"
            >
              ×
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={agregarRenglon}
          className="rounded-md border border-primary/30 bg-white px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/5"
        >
          + Otro renglón
        </button>
        <FormMessage state={state} />
        <div>
          <Boton />
        </div>
      </form>
    </details>
  );
}
