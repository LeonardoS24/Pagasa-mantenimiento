"use client";

import { useState, useTransition } from "react";
import { abrirEditorDiseno, guardarDisenoFicha } from "@/actions/diseno-ficha-actions";
import { COLORES, NOMBRES_COLOR, ordenPorDefecto, type AnchoRecuadro, type DisenoFicha } from "@/lib/diseno-ficha";
import { SECTION_STYLES, type SectionColorKey } from "@/lib/section-colors";

export type RecuadroEditable = { clave: string; titulo: string; colorBase: SectionColorKey; propio: boolean };

type Item = RecuadroEditable & { ancho: AnchoRecuadro; color: SectionColorKey };

function armar(recuadros: RecuadroEditable[], inicial: DisenoFicha): Item[] {
  return recuadros
    .map((r, i) => ({ r, i, orden: inicial[r.clave]?.orden ?? ordenPorDefecto(r.clave) }))
    .sort((a, b) => a.orden - b.orden || a.i - b.i)
    .map(({ r }) => ({ ...r, ancho: inicial[r.clave]?.ancho ?? "completo", color: inicial[r.clave]?.color ?? r.colorBase }));
}

export function AcomodarFicha({
  apartadoSlug,
  apartadoNombre,
  recuadros,
  inicial,
}: {
  apartadoSlug: string;
  apartadoNombre: string;
  recuadros: RecuadroEditable[];
  inicial: DisenoFicha;
}) {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [items, setItems] = useState<Item[]>(() => armar(recuadros, inicial));
  const [guardado, setGuardado] = useState<string>(() => JSON.stringify(armar(recuadros, inicial)));
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [pidiendoClave, setPidiendoClave] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [pendiente, empezar] = useTransition();

  const hayCambios = JSON.stringify(items) !== guardado;

  function abrir() {
    setMensaje(null);
    empezar(async () => {
      const r = await abrirEditorDiseno(clave);
      setClave("");
      if (r.ok) setAbierto(true);
      else setMensaje({ tipo: "error", texto: r.error });
    });
  }

  function mover(desde: number, hasta: number) {
    if (desde === hasta || hasta < 0 || hasta >= items.length) return;
    setItems((prev) => {
      const copia = [...prev];
      const [x] = copia.splice(desde, 1);
      copia.splice(hasta, 0, x);
      return copia;
    });
  }

  function cambiar(i: number, cambio: Partial<Pick<Item, "ancho" | "color">>) {
    setItems((prev) => prev.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  }

  function deFabrica() {
    setItems(armar(recuadros, {}));
    setMensaje(null);
  }

  // Lo que se guarda: solo lo que difiere de fábrica. Si todo es de fábrica,
  // el diseño queda vacío y la ficha vuelve a verse como siempre.
  function diseno(): DisenoFicha {
    const base = armar(recuadros, {});
    const salida: DisenoFicha = {};
    items.forEach((x, i) => {
      const f = base[i]?.clave === x.clave;
      const ajuste: DisenoFicha[string] = {};
      if (!f) ajuste.orden = (i + 1) * 10;
      if (x.ancho !== "completo") ajuste.ancho = x.ancho;
      if (x.color !== x.colorBase) ajuste.color = x.color;
      if (Object.keys(ajuste).length > 0) salida[x.clave] = ajuste;
    });
    // Si algo se movió, todos llevan su lugar (para que el orden sea completo).
    if (items.some((x, i) => base[i]?.clave !== x.clave)) {
      items.forEach((x, i) => {
        salida[x.clave] = { ...salida[x.clave], orden: (i + 1) * 10 };
      });
    }
    return salida;
  }

  function guardar() {
    setMensaje(null);
    empezar(async () => {
      const r = await guardarDisenoFicha(apartadoSlug, diseno(), clave);
      setClave("");
      if (r.ok) {
        setGuardado(JSON.stringify(items));
        setPidiendoClave(false);
        setMensaje({ tipo: "ok", texto: "Guardado. Las fichas de este apartado ya se ven así para todos." });
      } else {
        setMensaje({ tipo: "error", texto: r.error });
      }
    });
  }

  if (!abierto) {
    return (
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase text-primary-bright">Acomodar la ficha de {apartadoNombre}</h2>
        <p className="mb-3 text-sm text-ink">Para entrar al editor escribe tu contraseña. Se vuelve a pedir al guardar.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            abrir();
          }}
          className="flex gap-2"
        >
          <input
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete="current-password"
            placeholder="Tu contraseña"
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="submit" disabled={pendiente || !clave} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
            {pendiente ? "Revisando…" : "Abrir editor"}
          </button>
        </form>
        {mensaje && <p className="mt-2 text-sm text-red-700">{mensaje.texto}</p>}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-2">
        <p className="text-sm text-ink">
          Acomodando <strong>{apartadoNombre}</strong>. Arrastra los recuadros; la ficha real usa 2 columnas en pantalla ancha.
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={deFabrica} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-ink hover:bg-gray-100">
            Volver al diseño de fábrica
          </button>
          <button
            type="button"
            disabled={!hayCambios || pendiente}
            onClick={() => setPidiendoClave(true)}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Guardar diseño
          </button>
        </div>
      </div>

      {pidiendoClave && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
          className="mb-4 flex max-w-md flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3"
        >
          <p className="w-full text-sm text-amber-900">Para guardar, escribe de nuevo tu contraseña.</p>
          <input
            type="password"
            autoFocus
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            autoComplete="current-password"
            placeholder="Tu contraseña"
            className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <button type="submit" disabled={pendiente || !clave} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50">
            {pendiente ? "Guardando…" : "Confirmar y guardar"}
          </button>
          <button type="button" onClick={() => { setPidiendoClave(false); setClave(""); }} className="text-sm text-ink hover:underline">
            Cancelar
          </button>
        </form>
      )}

      {mensaje && (
        <p className={`mb-4 rounded-md px-3 py-2 text-sm ${mensaje.tipo === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{mensaje.texto}</p>
      )}
      {hayCambios && !pidiendoClave && <p className="mb-3 text-sm text-amber-800">Hay cambios sin guardar.</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {items.map((x, i) => (
          <div
            key={x.clave}
            draggable
            onDragStart={() => setArrastrando(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setSobre(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (arrastrando !== null) mover(arrastrando, i);
              setArrastrando(null);
              setSobre(null);
            }}
            onDragEnd={() => {
              setArrastrando(null);
              setSobre(null);
            }}
            style={{ gridColumn: x.ancho === "mitad" ? "span 1 / span 1" : "1 / -1" }}
            className={`min-w-0 cursor-grab rounded-md p-4 active:cursor-grabbing ${SECTION_STYLES[x.color]} ${
              arrastrando === i ? "opacity-40" : ""
            } ${sobre === i && arrastrando !== null && arrastrando !== i ? "ring-2 ring-primary" : ""}`}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold uppercase text-primary-bright">
                  <span aria-hidden className="mr-1 select-none text-gray-400">⠿</span>
                  {x.titulo}
                </p>
                {x.propio && <p className="text-xs text-gray-600">Recuadro propio</p>}
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => mover(i, i - 1)} disabled={i === 0} aria-label={`Subir ${x.titulo}`} className="rounded border border-gray-300 bg-white px-2 text-sm disabled:opacity-30">
                  ▲
                </button>
                <button type="button" onClick={() => mover(i, i + 1)} disabled={i === items.length - 1} aria-label={`Bajar ${x.titulo}`} className="rounded border border-gray-300 bg-white px-2 text-sm disabled:opacity-30">
                  ▼
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="inline-flex overflow-hidden rounded-md border border-gray-300 text-xs">
                {(["completo", "mitad"] as AnchoRecuadro[]).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => cambiar(i, { ancho: a })}
                    aria-pressed={x.ancho === a}
                    className={`px-2.5 py-1 ${x.ancho === a ? "bg-primary text-white" : "bg-white text-ink hover:bg-gray-100"}`}
                  >
                    {a === "completo" ? "Ancho completo" : "Mitad"}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Color de ${x.titulo}`}>
                {COLORES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={NOMBRES_COLOR[c]}
                    aria-label={NOMBRES_COLOR[c]}
                    aria-pressed={x.color === c}
                    onClick={() => cambiar(i, { color: c })}
                    className={`h-6 w-6 rounded border ${SECTION_STYLES[c]} ${x.color === c ? "ring-2 ring-primary ring-offset-1" : "border-gray-300"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
