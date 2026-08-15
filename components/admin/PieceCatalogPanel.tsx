"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { addCatalogPiece, deleteCatalogPiece } from "@/actions/piece-catalog-actions";
import type { ActionState } from "@/actions/user-actions";
import { PIECE_GROUPS, CATEGORIA_NUEVA, type PieceGroup } from "@/lib/piece-catalog";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export type PiezaAgregada = {
  id: string;
  categoria: string;
  nombre: string;
  grupo: PieceGroup;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Agregando..." : "Agregar pieza"}
    </button>
  );
}

function BotonQuitar({ pieza }: { pieza: PiezaAgregada }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm(`¿Quitar "${pieza.nombre}" del catálogo?`)) return;
          startTransition(async () => {
            const result = await deleteCatalogPiece(pieza.id, {}, new FormData());
            setError(result.error ?? null);
          });
        }}
        className="text-xs text-red-600 hover:underline disabled:opacity-60"
      >
        Quitar
      </button>
      {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
    </>
  );
}

// Catálogo de piezas y refacciones: la lista fija vive en el código
// (lib/piece-catalog.ts) y aquí se le agregan las que hagan falta con el
// tiempo, sin tocar el sistema. Lo agregado aquí aparece en el selector de
// pieza al registrar un mantenimiento y en el de "Elegir del catálogo" al
// levantar una orden.
export function PieceCatalogPanel({
  categoriasPorGrupo,
  catalogo,
  agregadas,
}: {
  categoriasPorGrupo: Record<PieceGroup, string[]>;
  catalogo: Record<string, string[]>;
  agregadas: PiezaAgregada[];
}) {
  const [state, formAction] = useFormState(addCatalogPiece, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const [grupo, setGrupo] = useState<PieceGroup>("Unidades");
  const [categoria, setCategoria] = useState("");
  const [verGrupo, setVerGrupo] = useState<PieceGroup>("Unidades");

  const categorias = categoriasPorGrupo[grupo] ?? [];
  const agregadasPorCategoria = useMemo(() => {
    const mapa = new Map<string, PiezaAgregada[]>();
    for (const pieza of agregadas) {
      const lista = mapa.get(pieza.categoria) ?? [];
      lista.push(pieza);
      mapa.set(pieza.categoria, lista);
    }
    return mapa;
  }, [agregadas]);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Agregar pieza o refacción</h2>
        <p className="mb-4 mt-1 text-xs text-gray-500">
          Aparecerá en el selector de pieza al registrar un mantenimiento y en &quot;Elegir del
          catálogo&quot; al levantar una orden, en todas las ciudades.
        </p>

        <form
          ref={formRef}
          action={async (formData) => {
            await formAction(formData);
            formRef.current?.reset();
            setCategoria("");
          }}
          className="space-y-3"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pc-grupo">
                Piezas de
              </label>
              <select
                id="pc-grupo"
                name="grupo"
                value={grupo}
                onChange={(e) => {
                  setGrupo(e.target.value as PieceGroup);
                  setCategoria("");
                }}
                className={inputClass}
              >
                {PIECE_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pc-categoria">
                Categoría
              </label>
              <select
                id="pc-categoria"
                name="categoria"
                required
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  Selecciona...
                </option>
                {categorias.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={CATEGORIA_NUEVA}>+ Categoría nueva...</option>
              </select>
            </div>

            {categoria === CATEGORIA_NUEVA && (
              <div>
                <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pc-categoriaNueva">
                  Nombre de la categoría
                </label>
                <input
                  id="pc-categoriaNueva"
                  name="categoriaNueva"
                  required
                  placeholder="Ej. Herramienta especial"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-ink" htmlFor="pc-nombre">
                Pieza o refacción
              </label>
              <input
                id="pc-nombre"
                name="nombre"
                required
                placeholder="Ej. Filtro de gas L.P."
                className={inputClass}
              />
            </div>
          </div>

          <FormMessage state={state} />
          <SubmitButton />
        </form>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold uppercase text-primary-bright">Catálogo actual</h2>
            <p className="mt-1 text-xs text-gray-500">
              Las piezas agregadas desde aquí se pueden quitar; las que vienen de fábrica no.
            </p>
          </div>
          <select
            value={verGrupo}
            onChange={(e) => setVerGrupo(e.target.value as PieceGroup)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-ink"
          >
            {PIECE_GROUPS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4">
          {(categoriasPorGrupo[verGrupo] ?? []).map((cat) => {
            const piezas = catalogo[cat] ?? [];
            const agregadasAqui = agregadasPorCategoria.get(cat) ?? [];
            const agregadasNombres = new Set(agregadasAqui.map((p) => p.nombre));
            return (
              <div key={cat} className="rounded-md border border-gray-100 p-3">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                  {cat} <span className="font-normal normal-case">({piezas.length})</span>
                </p>
                <ul className="flex flex-wrap gap-2">
                  {piezas.map((pieza) => {
                    const agregada = agregadasAqui.find((p) => p.nombre === pieza);
                    return (
                      <li
                        key={pieza}
                        className={`rounded-full px-3 py-1 text-xs ${
                          agregadasNombres.has(pieza)
                            ? "bg-accent-light/20 text-accent"
                            : "bg-gray-100 text-ink"
                        }`}
                      >
                        {pieza}
                        {agregada && (
                          <>
                            {" · "}
                            <BotonQuitar pieza={agregada} />
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
