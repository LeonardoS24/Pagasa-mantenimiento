"use client";

import { useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { abrirEditorDiseno, guardarEditorFicha, type CambiosEditorFicha } from "@/actions/diseno-ficha-actions";
import { COLORES, NOMBRES_COLOR, RECUADROS_FICHA, banderasFicha, ordenPorDefecto, type AnchoRecuadro, type DisenoFicha } from "@/lib/diseno-ficha";
import type { CustomFieldDef, CustomSectionDef } from "@/lib/custom-fields";
import type { Plazos } from "@/lib/plazos";
import { TechnicalSheetForm } from "./TechnicalSheetForm";
import { CAMPO_TIPOS, campoTipoLabels, parseOpcionesTexto, type CampoTipo } from "@/lib/custom-fields";
import { SECTION_STYLES, type SectionColorKey } from "@/lib/section-colors";

export type CampoEditable = { id: string; etiqueta: string; tipo: CampoTipo; opciones?: string[]; usos: number; todos: boolean };
export type RecuadroEditable = {
  clave: string;
  titulo: string;
  colorBase: SectionColorKey;
  propio: boolean;
  // Recuadro propio que se ve en todos los apartados (no solo en este).
  todos: boolean;
  campos: CampoEditable[];
};

type Campo = CampoEditable & { nuevo?: boolean };
type Tarjeta = Omit<RecuadroEditable, "campos"> & { campos: Campo[]; ancho: AnchoRecuadro; color: SectionColorKey; oculto: boolean; nuevo?: boolean };
type Mensaje = { tipo: "ok" | "error"; texto: string } | null;

function armar(recuadros: RecuadroEditable[], inicial: DisenoFicha): Tarjeta[] {
  return recuadros
    .map((r, i) => ({ r, i, orden: inicial[r.clave]?.orden ?? ordenPorDefecto(r.clave) }))
    .sort((a, b) => a.orden - b.orden || a.i - b.i)
    .map(({ r }) => ({
      ...r,
      ancho: inicial[r.clave]?.ancho ?? "completo",
      color: inicial[r.clave]?.color ?? r.colorBase,
      oculto: inicial[r.clave]?.oculto ?? false,
    }));
}

const sumaUsos = (t: Tarjeta) => t.campos.reduce((s, f) => s + (f.nuevo ? 0 : f.usos), 0);

export function AcomodarFicha(props: {
  apartadoSlug: string;
  apartadoNombre: string;
  recuadros: RecuadroEditable[];
  inicial: DisenoFicha;
  version: string;
  plazos: Plazos;
}) {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState("");
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [pendiente, empezar] = useTransition();

  if (!abierto) {
    return (
      <div className="max-w-md rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase text-primary-bright">Editar la ficha de {props.apartadoNombre}</h2>
        <p className="mb-3 text-sm text-ink">Para entrar al editor escribe tu contraseña. Se vuelve a pedir al guardar.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMensaje(null);
            empezar(async () => {
              const r = await abrirEditorDiseno(clave);
              setClave("");
              if (r.ok) setAbierto(true);
              else setMensaje({ tipo: "error", texto: r.error });
            });
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
    <>
      {mensaje && (
        <p className={`mb-4 rounded-md px-3 py-2 text-sm ${mensaje.tipo === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{mensaje.texto}</p>
      )}
      <Lienzo key={props.version} {...props} setMensaje={setMensaje} />
    </>
  );
}

function Lienzo({
  apartadoSlug,
  apartadoNombre,
  recuadros,
  inicial,
  plazos,
  setMensaje,
}: {
  apartadoSlug: string;
  apartadoNombre: string;
  recuadros: RecuadroEditable[];
  inicial: DisenoFicha;
  plazos: Plazos;
  setMensaje: (m: Mensaje) => void;
}) {
  const [vista, setVista] = useState<"ficha" | "lista">("ficha");
  const router = useRouter();
  const [items, setItems] = useState<Tarjeta[]>(() => armar(recuadros, inicial));
  const [recuadrosEliminados, setRecuadrosEliminados] = useState<string[]>([]);
  const [camposEliminados, setCamposEliminados] = useState<string[]>([]);
  const [foto] = useState(() => JSON.stringify([armar(recuadros, inicial), [], []]));
  const contador = useRef(1);
  const nuevoId = () => `n${contador.current++}`;

  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [pidiendoClave, setPidiendoClave] = useState(false);
  const [clave, setClave] = useState("");
  const [pendiente, empezar] = useTransition();

  const hayCambios = JSON.stringify([items, recuadrosEliminados, camposEliminados]) !== foto;

  function mover(desde: number, hasta: number) {
    if (desde === hasta || hasta < 0 || hasta >= items.length) return;
    setItems((prev) => {
      const copia = [...prev];
      const [x] = copia.splice(desde, 1);
      copia.splice(hasta, 0, x);
      return copia;
    });
  }

  function cambiar(i: number, cambio: Partial<Tarjeta>) {
    setItems((prev) => prev.map((x, j) => (j === i ? { ...x, ...cambio } : x)));
  }

  function eliminarRecuadro(i: number) {
    const t = items[i];
    const datos = sumaUsos(t);
    const avisos = [
      `¿Eliminar el recuadro «${t.titulo}»?`,
      t.campos.length > 0 ? `Se quitan también sus ${t.campos.length} campo(s).` : "",
      datos > 0 ? `Se BORRARÁN ${datos} dato(s) ya capturado(s) en las unidades.` : "",
      t.todos ? "Este recuadro se ve en TODOS los apartados: desaparece de todos." : "",
      "Se aplica hasta que guardes.",
    ].filter(Boolean);
    if (!window.confirm(avisos.join("\n"))) return;
    if (!t.nuevo) setRecuadrosEliminados((prev) => [...prev, t.clave.slice(2)]);
    setItems((prev) => prev.filter((_, j) => j !== i));
  }

  function agregarRecuadro(datos: { titulo: string; posicion: number; ancho: AnchoRecuadro; color: SectionColorKey }) {
    const nuevo: Tarjeta = {
      clave: `x:${nuevoId()}`,
      titulo: datos.titulo,
      colorBase: "propio",
      propio: true,
      todos: false,
      campos: [],
      ancho: datos.ancho,
      color: datos.color,
      oculto: false,
      nuevo: true,
    };
    setItems((prev) => {
      const copia = [...prev];
      copia.splice(datos.posicion, 0, nuevo);
      return copia;
    });
    setAgregando(false);
  }

  function cambiarCampos(i: number, fn: (campos: Campo[]) => Campo[]) {
    setItems((prev) => prev.map((x, j) => (j === i ? { ...x, campos: fn(x.campos) } : x)));
  }

  function quitarCampo(i: number, f: Campo) {
    const avisos = [
      `¿Quitar el campo «${f.etiqueta}»?`,
      f.usos > 0 && !f.nuevo ? `Se BORRARÁN ${f.usos} dato(s) ya capturado(s).` : "",
      f.todos ? "Este campo se ve en TODOS los apartados: desaparece de todos." : "",
      "Se aplica hasta que guardes.",
    ].filter(Boolean);
    if (!window.confirm(avisos.join("\n"))) return;
    if (!f.nuevo) setCamposEliminados((prev) => [...prev, f.id]);
    cambiarCampos(i, (cs) => cs.filter((x) => x.id !== f.id));
  }

  // Lo que se manda al servidor: solo las diferencias contra lo guardado.
  function cambios(): CambiosEditorFicha {
    const origR = new Map(recuadros.map((r) => [r.clave, r]));
    const origC = new Map(recuadros.flatMap((r) => r.campos).map((f) => [f.id, f]));
    const base = armar(recuadros, {}).filter((t) => items.some((x) => x.clave === t.clave));
    const movido = items.length !== base.length || items.some((x, i) => base[i]?.clave !== x.clave);
    const diseno: DisenoFicha = {};
    items.forEach((x, i) => {
      const a: DisenoFicha[string] = {};
      if (movido) a.orden = (i + 1) * 10;
      if (x.ancho !== "completo") a.ancho = x.ancho;
      if (x.color !== x.colorBase) a.color = x.color;
      if (x.oculto) a.oculto = true;
      if (Object.keys(a).length > 0) diseno[x.clave] = a;
    });
    return {
      recuadrosNuevos: items.filter((t) => t.nuevo).map((t) => ({ tempId: t.clave.slice(2), titulo: t.titulo })),
      recuadrosRenombrados: items
        .filter((t) => t.propio && !t.nuevo && t.titulo !== origR.get(t.clave)?.titulo)
        .map((t) => ({ id: t.clave.slice(2), titulo: t.titulo })),
      recuadrosEliminados,
      camposNuevos: items.flatMap((t) =>
        t.campos.filter((f) => f.nuevo).map((f) => ({ tempId: f.id, seccion: t.clave, etiqueta: f.etiqueta, tipo: f.tipo, opciones: f.opciones }))
      ),
      camposEditados: items
        .flatMap((t) => t.campos.filter((f) => !f.nuevo))
        .filter((f) => {
          const o = origC.get(f.id);
          return o && (o.etiqueta !== f.etiqueta || JSON.stringify(o.opciones ?? []) !== JSON.stringify(f.opciones ?? []));
        })
        .map((f) => ({ id: f.id, etiqueta: f.etiqueta, opciones: f.opciones })),
      camposEliminados,
      ordenCampos: Object.fromEntries(items.map((t) => [t.clave, t.campos.map((f) => f.id)])),
      diseno,
    };
  }

  function guardar() {
    setMensaje(null);
    empezar(async () => {
      const r = await guardarEditorFicha(apartadoSlug, cambios(), clave);
      setClave("");
      if (r.ok) {
        setPidiendoClave(false);
        setMensaje({ tipo: "ok", texto: `Guardado${r.resumen ? ` (${r.resumen})` : ""}. Las fichas de ${apartadoNombre} ya se ven así para todos.` });
        router.refresh();
      } else {
        setMensaje({ tipo: "error", texto: r.error });
      }
    });
  }

  return (
    <div>
      <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-md border border-gray-300 bg-white/95 px-4 py-2 shadow-sm backdrop-blur">
        <p className="text-sm text-ink">
          Editando <strong>{apartadoNombre}</strong>
          {hayCambios ? <span className="ml-2 font-medium text-amber-700">· Hay cambios sin guardar</span> : <span className="ml-2 text-gray-500">· Sin cambios</span>}
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => setAgregando((v) => !v)} className="rounded-md border border-accent bg-accent px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">
            + Agregar recuadro
          </button>
          <button
            type="button"
            onClick={() => setItems((prev) => [...armar(prev.filter((t) => !t.nuevo), {}), ...prev.filter((t) => t.nuevo)])}
            title="Regresa el orden, ancho y color de fábrica (no deshace recuadros ni campos)"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-ink hover:bg-gray-100"
          >
            Acomodo de fábrica
          </button>
          <button
            type="button"
            disabled={!hayCambios || pendiente}
            onClick={() => {
              if (window.confirm("¿Descartar todos los cambios sin guardar?")) {
                setItems(armar(recuadros, inicial));
                setRecuadrosEliminados([]);
                setCamposEliminados([]);
              }
            }}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-ink hover:bg-gray-100 disabled:opacity-40"
          >
            Descartar
          </button>
          <button
            type="button"
            disabled={!hayCambios || pendiente}
            onClick={() => setPidiendoClave(true)}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-50"
          >
            Guardar cambios
          </button>
        </div>
      </div>

      {pidiendoClave && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
          className="mb-4 flex max-w-lg flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-3"
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

      {agregando && <NuevoRecuadro items={items} onAgregar={agregarRecuadro} onCancelar={() => setAgregando(false)} />}

      <div className="mb-3 inline-flex overflow-hidden rounded-md border border-gray-300 text-sm">
        {(["ficha", "lista"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setVista(v)}
            aria-pressed={vista === v}
            className={`px-3 py-1.5 ${vista === v ? "bg-primary text-white" : "bg-white text-ink hover:bg-gray-100"}`}
          >
            {v === "ficha" ? "Ver como la ficha" : "Ver como lista"}
          </button>
        ))}
      </div>

      {vista === "ficha" ? (
        <VistaFicha
          items={items}
          apartadoSlug={apartadoSlug}
          plazos={plazos}
          onMover={mover}
          onCambiar={cambiar}
          onEliminar={eliminarRecuadro}
          onCampos={cambiarCampos}
          onQuitarCampo={quitarCampo}
          onAgregarRecuadro={agregarRecuadro}
          nuevoId={nuevoId}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {items.map((x, i) => (
            <div
              key={x.clave}
              draggable
              onDragStart={(e) => {
                // Solo se arrastra desde la tarjeta, no al seleccionar texto de un campo.
                if ((e.target as HTMLElement).closest("input, textarea, select")) {
                  e.preventDefault();
                  return;
                }
                setArrastrando(i);
              }}
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
              className={`min-w-0 rounded-md p-4 ${SECTION_STYLES[x.color]} ${arrastrando === i ? "opacity-40" : ""} ${
                sobre === i && arrastrando !== null && arrastrando !== i ? "ring-2 ring-primary" : ""
              } ${x.oculto ? "opacity-60" : ""}`}
            >
              <TarjetaRecuadro
                t={x}
                primero={i === 0}
                ultimo={i === items.length - 1}
                onSubir={() => mover(i, i - 1)}
                onBajar={() => mover(i, i + 1)}
                onCambiar={(c) => cambiar(i, c)}
                onEliminar={() => eliminarRecuadro(i)}
                onCampos={(fn) => cambiarCampos(i, fn)}
                onQuitarCampo={(f) => quitarCampo(i, f)}
                nuevoId={nuevoId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NuevoRecuadro({
  items,
  posicionInicial,
  onAgregar,
  onCancelar,
}: {
  items: Tarjeta[];
  posicionInicial?: number;
  onAgregar: (d: { titulo: string; posicion: number; ancho: AnchoRecuadro; color: SectionColorKey }) => void;
  onCancelar: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [posicion, setPosicion] = useState(posicionInicial ?? items.length);
  const [ancho, setAncho] = useState<AnchoRecuadro>("completo");
  const [color, setColor] = useState<SectionColorKey>("propio");
  const valido = titulo.trim().length >= 2;
  return (
    <div className="mb-4 rounded-md border-2 border-dashed border-accent bg-orange-50/40 p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Recuadro nuevo</h3>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-ink">
          Título
          <input
            autoFocus
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={80}
            placeholder="Ej. Sistema contra incendio"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm text-ink">
          ¿Dónde va?
          <select value={posicion} onChange={(e) => setPosicion(Number(e.target.value))} className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value={0}>Al principio de la ficha</option>
            {items.map((t, i) => (
              <option key={t.clave} value={i + 1}>
                Después de «{t.titulo}»
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm text-ink">
          Ancho
          <div className="mt-1 inline-flex overflow-hidden rounded-md border border-gray-300 text-xs">
            {(["completo", "mitad"] as AnchoRecuadro[]).map((a) => (
              <button key={a} type="button" onClick={() => setAncho(a)} aria-pressed={ancho === a} className={`px-3 py-1.5 ${ancho === a ? "bg-primary text-white" : "bg-white text-ink"}`}>
                {a === "completo" ? "Ancho completo" : "Mitad"}
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm text-ink">
          Color
          <SelectorColor valor={color} onElegir={setColor} etiqueta="Color del recuadro nuevo" />
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-600">Después agrégale sus campos: un recuadro sin campos no aparece en la ficha de las unidades.</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!valido}
          onClick={() => onAgregar({ titulo: titulo.trim(), posicion, ancho, color })}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Agregar aquí
        </button>
        <button type="button" onClick={onCancelar} className="text-sm text-ink hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function SelectorColor({ valor, onElegir, etiqueta }: { valor: SectionColorKey; onElegir: (c: SectionColorKey) => void; etiqueta: string }) {
  return (
    <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label={etiqueta}>
      {COLORES.map((c) => (
        <button
          key={c}
          type="button"
          title={NOMBRES_COLOR[c]}
          aria-label={NOMBRES_COLOR[c]}
          aria-pressed={valor === c}
          onClick={() => onElegir(c)}
          className={`h-6 w-6 rounded border ${SECTION_STYLES[c]} ${valor === c ? "ring-2 ring-primary ring-offset-1" : "border-gray-300"}`}
        />
      ))}
    </div>
  );
}

function TarjetaRecuadro({
  t,
  primero,
  ultimo,
  onSubir,
  onBajar,
  onCambiar,
  onEliminar,
  onCampos,
  onQuitarCampo,
  nuevoId,
}: {
  t: Tarjeta;
  primero: boolean;
  ultimo: boolean;
  onSubir: () => void;
  onBajar: () => void;
  onCambiar: (c: Partial<Tarjeta>) => void;
  onEliminar: () => void;
  onCampos: (fn: (c: Campo[]) => Campo[]) => void;
  onQuitarCampo: (f: Campo) => void;
  nuevoId: () => string;
}) {
  const [renombrando, setRenombrando] = useState(false);
  const [titulo, setTitulo] = useState(t.titulo);
  const [agregandoCampo, setAgregandoCampo] = useState(false);

  const moverCampo = (k: number, d: number) =>
    onCampos((cs) => {
      const j = k + d;
      if (j < 0 || j >= cs.length) return cs;
      const copia = [...cs];
      [copia[k], copia[j]] = [copia[j], copia[k]];
      return copia;
    });

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {renombrando ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (titulo.trim().length < 2) return;
                onCambiar({ titulo: titulo.trim() });
                setRenombrando(false);
              }}
              className="flex gap-1"
            >
              <input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={80} className="rounded border border-gray-300 px-2 py-1 text-sm" />
              <button type="submit" className="rounded bg-primary px-2 text-xs text-white">
                Listo
              </button>
            </form>
          ) : (
            <p className="cursor-grab text-sm font-semibold uppercase text-primary-bright active:cursor-grabbing" title="Arrastra para mover">
              <span aria-hidden className="mr-1 select-none text-gray-400">⠿</span>
              {t.titulo}
            </p>
          )}
          <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
            {t.nuevo && <span className="rounded bg-accent px-1.5 text-white">Nuevo</span>}
            {t.propio ? <span className="rounded bg-white/80 px-1.5 text-gray-700">Recuadro propio</span> : <span className="rounded bg-white/80 px-1.5 text-gray-700">De fábrica</span>}
            {t.todos && <span className="rounded bg-amber-100 px-1.5 text-amber-800">En todos los apartados</span>}
            {t.oculto && <span className="rounded bg-gray-700 px-1.5 text-white">Oculto en la ficha</span>}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1">
          <button type="button" onClick={onSubir} disabled={primero} aria-label={`Subir ${t.titulo}`} className="rounded border border-gray-300 bg-white px-2 text-sm disabled:opacity-30">
            ▲
          </button>
          <button type="button" onClick={onBajar} disabled={ultimo} aria-label={`Bajar ${t.titulo}`} className="rounded border border-gray-300 bg-white px-2 text-sm disabled:opacity-30">
            ▼
          </button>
          {t.propio && (
            <button type="button" onClick={() => { setTitulo(t.titulo); setRenombrando(true); }} className="rounded border border-gray-300 bg-white px-2 text-xs">
              Renombrar
            </button>
          )}
          {t.propio ? (
            <button type="button" onClick={onEliminar} className="rounded border border-red-300 bg-white px-2 text-xs text-red-700 hover:bg-red-50">
              Eliminar
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onCambiar({ oculto: !t.oculto })}
              title="Los recuadros de fábrica no se borran porque de ellos salen las alertas: se ocultan. Sus datos se conservan."
              className="rounded border border-gray-300 bg-white px-2 text-xs"
            >
              {t.oculto ? "Mostrar" : "Quitar (ocultar)"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="inline-flex overflow-hidden rounded-md border border-gray-300 text-xs">
          {(["completo", "mitad"] as AnchoRecuadro[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => onCambiar({ ancho: a })}
              aria-pressed={t.ancho === a}
              className={`px-2.5 py-1 ${t.ancho === a ? "bg-primary text-white" : "bg-white text-ink hover:bg-gray-100"}`}
            >
              {a === "completo" ? "Ancho completo" : "Mitad"}
            </button>
          ))}
        </div>
        <SelectorColor valor={t.color} onElegir={(c) => onCambiar({ color: c })} etiqueta={`Color de ${t.titulo}`} />
      </div>

      <div className="mt-3 rounded-md bg-white/70 p-2">
        <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
          {t.propio ? "Campos" : "Campos agregados (los de fábrica siguen igual)"}
        </p>
        {t.campos.length === 0 && <p className="text-xs text-gray-500">{t.propio ? "Sin campos todavía: así no aparece en la ficha." : "Ninguno."}</p>}
        <ul className="space-y-1">
          {t.campos.map((f, k) => (
            <FilaCampo
              key={f.id}
              f={f}
              primero={k === 0}
              ultimo={k === t.campos.length - 1}
              onSubir={() => moverCampo(k, -1)}
              onBajar={() => moverCampo(k, 1)}
              onGuardar={(c) => onCampos((cs) => cs.map((x) => (x.id === f.id ? { ...x, ...c } : x)))}
              onQuitar={() => onQuitarCampo(f)}
            />
          ))}
        </ul>
        {agregandoCampo ? (
          <NuevoCampo
            nombres={t.campos.map((f) => f.etiqueta.toLowerCase())}
            onAgregar={(c) => {
              onCampos((cs) => [...cs, { id: nuevoId(), usos: 0, todos: false, nuevo: true, ...c }]);
              setAgregandoCampo(false);
            }}
            onCancelar={() => setAgregandoCampo(false)}
          />
        ) : (
          <button type="button" onClick={() => setAgregandoCampo(true)} className="mt-2 text-xs font-medium text-primary hover:underline">
            + Agregar campo
          </button>
        )}
      </div>
    </div>
  );
}

function FilaCampo({
  f,
  primero,
  ultimo,
  onSubir,
  onBajar,
  onGuardar,
  onQuitar,
}: {
  f: Campo;
  primero: boolean;
  ultimo: boolean;
  onSubir: () => void;
  onBajar: () => void;
  onGuardar: (c: { etiqueta: string; opciones?: string[] }) => void;
  onQuitar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [etiqueta, setEtiqueta] = useState(f.etiqueta);
  const [opciones, setOpciones] = useState((f.opciones ?? []).join("\n"));

  if (editando) {
    return (
      <li className="rounded border border-gray-300 bg-white p-2">
        <input value={etiqueta} onChange={(e) => setEtiqueta(e.target.value)} maxLength={80} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
        {f.tipo === "LISTA" && (
          <textarea
            value={opciones}
            onChange={(e) => setOpciones(e.target.value)}
            rows={3}
            placeholder="Una opción por renglón"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        )}
        {f.todos && <p className="mt-1 text-[11px] text-amber-800">Este campo está en todos los apartados: el cambio se ve en todos.</p>}
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            disabled={etiqueta.trim().length < 2 || (f.tipo === "LISTA" && parseOpcionesTexto(opciones).length === 0)}
            onClick={() => {
              onGuardar({ etiqueta: etiqueta.trim(), ...(f.tipo === "LISTA" ? { opciones: parseOpcionesTexto(opciones) } : {}) });
              setEditando(false);
            }}
            className="rounded bg-primary px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            Listo
          </button>
          <button type="button" onClick={() => setEditando(false)} className="text-xs text-ink hover:underline">
            Cancelar
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-2 text-sm text-ink">
      <span className="min-w-0 flex-1">
        {f.etiqueta}
        <span className="ml-1 text-xs text-gray-500">
          · {campoTipoLabels[f.tipo]}
          {f.nuevo ? " · nuevo" : f.usos > 0 ? ` · ${f.usos} con dato` : ""}
          {f.todos ? " · en todos los apartados" : ""}
        </span>
      </span>
      <button type="button" onClick={onSubir} disabled={primero} aria-label={`Subir ${f.etiqueta}`} className="rounded border border-gray-300 bg-white px-1.5 text-xs disabled:opacity-30">
        ▲
      </button>
      <button type="button" onClick={onBajar} disabled={ultimo} aria-label={`Bajar ${f.etiqueta}`} className="rounded border border-gray-300 bg-white px-1.5 text-xs disabled:opacity-30">
        ▼
      </button>
      <button type="button" onClick={() => setEditando(true)} className="rounded border border-gray-300 bg-white px-1.5 text-xs">
        Editar
      </button>
      <button type="button" onClick={onQuitar} className="rounded border border-red-300 bg-white px-1.5 text-xs text-red-700">
        Quitar
      </button>
    </li>
  );
}

function NuevoCampo({
  nombres,
  onAgregar,
  onCancelar,
}: {
  nombres: string[];
  onAgregar: (c: { etiqueta: string; tipo: CampoTipo; opciones?: string[] }) => void;
  onCancelar: () => void;
}) {
  const [etiqueta, setEtiqueta] = useState("");
  const [tipo, setTipo] = useState<CampoTipo>("TEXTO");
  const [opciones, setOpciones] = useState("");
  const repetido = nombres.includes(etiqueta.trim().toLowerCase());
  const valido = etiqueta.trim().length >= 2 && !repetido && (tipo !== "LISTA" || parseOpcionesTexto(opciones).length > 0);
  return (
    <div className="mt-2 rounded border border-dashed border-gray-400 bg-white p-2">
      <div className="flex flex-wrap gap-2">
        <input
          autoFocus
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          maxLength={80}
          placeholder="Nombre del campo"
          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as CampoTipo)} className="w-full rounded border border-gray-300 px-2 py-1 text-sm">
          {CAMPO_TIPOS.map((t) => (
            <option key={t} value={t}>
              {campoTipoLabels[t]}
            </option>
          ))}
        </select>
      </div>
      {tipo === "LISTA" && (
        <textarea
          value={opciones}
          onChange={(e) => setOpciones(e.target.value)}
          rows={3}
          placeholder="Opciones, una por renglón"
          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
        />
      )}
      {repetido && <p className="mt-1 text-xs text-red-700">Ya hay un campo con ese nombre en este recuadro.</p>}
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          disabled={!valido}
          onClick={() => onAgregar({ etiqueta: etiqueta.trim(), tipo, ...(tipo === "LISTA" ? { opciones: parseOpcionesTexto(opciones) } : {}) })}
          className="rounded bg-primary px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          Agregar
        </button>
        <button type="button" onClick={onCancelar} className="text-xs text-ink hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

type Caja = { clave: string; top: number; left: number; width: number; height: number };
type Panel = { clave: string; tipo: "opciones" | "recuadro" | "renombrar" } | null;

const seccionDeCampos = (t: Tarjeta) => (t.propio ? t.clave : RECUADROS_FICHA.find((r) => r.clave === t.clave)?.seccionCampos ?? t.clave);

// La ficha tal como la verán las unidades (vacía, de ejemplo y sin poder
// escribir), con una barra encima de cada recuadro para acomodarlo y editarlo.
// Todo cambia al instante en la vista; se guarda con «Guardar cambios».
function VistaFicha({
  items,
  apartadoSlug,
  plazos,
  onMover,
  onCambiar,
  onEliminar,
  onCampos,
  onQuitarCampo,
  onAgregarRecuadro,
  nuevoId,
}: {
  items: Tarjeta[];
  apartadoSlug: string;
  plazos: Plazos;
  onMover: (desde: number, hasta: number) => void;
  onCambiar: (i: number, c: Partial<Tarjeta>) => void;
  onEliminar: (i: number) => void;
  onCampos: (i: number, fn: (c: Campo[]) => Campo[]) => void;
  onQuitarCampo: (i: number, f: Campo) => void;
  onAgregarRecuadro: (d: { titulo: string; posicion: number; ancho: AnchoRecuadro; color: SectionColorKey }) => void;
  nuevoId: () => string;
}) {
  const cont = useRef<HTMLDivElement>(null);
  const [cajas, setCajas] = useState<Caja[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  const [renombre, setRenombre] = useState("");

  // Lo que la ficha necesita para pintarse con lo que hay en el editor ahora.
  const vista = useMemo(() => {
    const camposExtra: CustomFieldDef[] = items.flatMap((t) =>
      t.campos.map((f, k) => ({
        id: f.id,
        ambito: "VEHICULO" as const,
        seccion: seccionDeCampos(t),
        apartadoSlug,
        etiqueta: f.etiqueta,
        tipo: f.tipo,
        orden: k,
        opciones: f.opciones,
      }))
    );
    const seccionesExtra: CustomSectionDef[] = items
      .filter((t) => t.propio)
      .map((t) => ({ id: t.clave.slice(2), ambito: "VEHICULO" as const, apartadoSlug, titulo: t.titulo, orden: 0 }));
    const diseno: DisenoFicha = {};
    items.forEach((t, i) => {
      diseno[t.clave] = { orden: (i + 1) * 10, ancho: t.ancho, color: t.color };
    });
    return { camposExtra, seccionesExtra, diseno };
  }, [items, apartadoSlug]);

  useLayoutEffect(() => {
    const el = cont.current;
    if (!el) return;
    const medir = () => {
      const base = el.getBoundingClientRect();
      const nuevas = Array.from(el.querySelectorAll<HTMLElement>("form [data-recuadro]"))
        .map((n) => {
          const r = n.getBoundingClientRect();
          return { clave: n.dataset.recuadro ?? "", top: r.top - base.top, left: r.left - base.left, width: r.width, height: r.height };
        })
        .filter((c) => c.width > 0 && c.clave);
      setCajas((prev) => (JSON.stringify(prev) === JSON.stringify(nuevas) ? prev : nuevas));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    el.querySelectorAll("form [data-recuadro]").forEach((n) => ro.observe(n));
    window.addEventListener("resize", medir);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [vista]);

  const boton = "rounded border border-gray-300 bg-white px-1.5 py-0.5 text-[11px] text-ink hover:bg-gray-100 disabled:opacity-30";

  return (
    <div>
      <p className="mb-2 text-xs text-gray-600">
        Así se ve la ficha de una unidad de este apartado (vacía, de ejemplo). Cada recuadro tiene su barra arriba a la derecha: <strong>⠿ Mover</strong> (arrástralo y suéltalo sobre
        otro recuadro), ▲ ▼ y <strong>✎ Editar</strong> (ancho, color, campos, recuadro nuevo abajo, ocultar o eliminar).
      </p>
      <div ref={cont} className="relative rounded-lg border border-gray-200 bg-white p-3">
        <TechnicalSheetForm
          vistaPrevia
          plazos={plazos}
          vehicleId="vista-previa"
          sheet={null}
          sectionSlug={apartadoSlug}
          {...banderasFicha(apartadoSlug)}
          camposExtra={vista.camposExtra}
          seccionesExtra={vista.seccionesExtra}
          diseno={vista.diseno}
        />

        {cajas.map((c) => {
          const i = items.findIndex((t) => t.clave === c.clave);
          if (i < 0) return null;
          const t = items[i];
          const destino = arrastrando !== null && arrastrando !== c.clave;
          return (
            <div
              key={c.clave}
              style={{ position: "absolute", top: c.top, left: c.left, width: c.width, height: c.height }}
              className={`rounded-md border-2 ${destino ? "pointer-events-auto" : "pointer-events-none"} ${
                destino && sobre === c.clave ? "border-primary bg-primary/10" : destino ? "border-dashed border-primary/40" : "border-transparent"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(c.clave);
              }}
              onDragLeave={() => setSobre((s) => (s === c.clave ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const desde = items.findIndex((x) => x.clave === arrastrando);
                if (desde >= 0) onMover(desde, i);
                setArrastrando(null);
                setSobre(null);
              }}
            >
              {t.oculto && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-gray-300/80">
                  <span className="rounded bg-gray-800 px-3 py-1 text-sm font-medium text-white">Oculto: no aparece en la ficha</span>
                </div>
              )}

              <div className="pointer-events-auto absolute -top-3 right-2 z-10 flex gap-1 rounded-md bg-white p-0.5 shadow ring-1 ring-gray-300">
                <span
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    setArrastrando(c.clave);
                    setPanel(null);
                  }}
                  onDragEnd={() => {
                    setArrastrando(null);
                    setSobre(null);
                  }}
                  title="Arrastra y suelta sobre otro recuadro"
                  className="cursor-grab select-none rounded bg-primary px-1.5 py-0.5 text-[11px] font-medium text-white active:cursor-grabbing"
                >
                  ⠿ Mover
                </span>
                <button type="button" className={boton} onClick={() => onMover(i, i - 1)} disabled={i === 0} aria-label={`Subir ${t.titulo}`}>
                  ▲
                </button>
                <button type="button" className={boton} onClick={() => onMover(i, i + 1)} disabled={i === items.length - 1} aria-label={`Bajar ${t.titulo}`}>
                  ▼
                </button>
                <button
                  type="button"
                  className={`${boton} border-primary font-medium text-primary`}
                  onClick={() => setPanel(panel?.clave === c.clave && panel.tipo === "opciones" ? null : { clave: c.clave, tipo: "opciones" })}
                >
                  ✎ Editar
                </button>
              </div>

              {panel?.clave === c.clave && (
                <div className="pointer-events-auto absolute right-1 top-6 z-20 w-[24rem] max-w-[90vw] rounded-md border border-gray-300 bg-white p-3 text-left shadow-lg">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase text-primary-bright">{t.titulo}</p>
                    <button type="button" onClick={() => setPanel(null)} className="text-xs text-ink hover:underline">
                      Cerrar
                    </button>
                  </div>
                  {panel.tipo === "opciones" && (
                    <div className="mb-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-ink">
                        Ancho:
                        <div className="inline-flex overflow-hidden rounded-md border border-gray-300">
                          {(["completo", "mitad"] as AnchoRecuadro[]).map((a) => (
                            <button
                              key={a}
                              type="button"
                              onClick={() => onCambiar(i, { ancho: a })}
                              aria-pressed={t.ancho === a}
                              className={`px-2.5 py-1 ${t.ancho === a ? "bg-primary text-white" : "bg-white text-ink hover:bg-gray-100"}`}
                            >
                              {a === "completo" ? "Completo" : "Mitad"}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="text-xs text-ink">
                        Color:
                        <SelectorColor valor={t.color} onElegir={(col) => onCambiar(i, { color: col })} etiqueta={`Color de ${t.titulo}`} />
                      </div>
                      <div className="flex flex-wrap gap-1 border-t border-gray-200 pt-2">
                        <button type="button" className={boton} onClick={() => setPanel({ clave: c.clave, tipo: "recuadro" })}>
                          + Recuadro nuevo abajo
                        </button>
                        {t.propio ? (
                          <>
                            <button
                              type="button"
                              className={boton}
                              onClick={() => {
                                setRenombre(t.titulo);
                                setPanel({ clave: c.clave, tipo: "renombrar" });
                              }}
                            >
                              Renombrar
                            </button>
                            <button
                              type="button"
                              className={`${boton} border-red-300 text-red-700`}
                              onClick={() => {
                                setPanel(null);
                                onEliminar(i);
                              }}
                            >
                              Eliminar recuadro
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className={boton}
                            title="Los recuadros de fábrica se ocultan (no se borran): sus datos se conservan y las alertas siguen."
                            onClick={() => onCambiar(i, { oculto: !t.oculto })}
                          >
                            {t.oculto ? "Mostrar en la ficha" : "Ocultar de la ficha"}
                          </button>
                        )}
                      </div>
                      <p className="border-t border-gray-200 pt-2 text-xs font-semibold uppercase text-gray-500">Campos</p>
                    </div>
                  )}
                  {panel.tipo === "renombrar" && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (renombre.trim().length < 2) return;
                        onCambiar(i, { titulo: renombre.trim() });
                        setPanel(null);
                      }}
                      className="flex gap-1"
                    >
                      <input
                        autoFocus
                        value={renombre}
                        onChange={(e) => setRenombre(e.target.value)}
                        maxLength={80}
                        className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <button type="submit" className="rounded bg-primary px-2 text-xs text-white">
                        Listo
                      </button>
                    </form>
                  )}
                  {panel.tipo === "opciones" && (
                    <div>
                      {!t.propio && <p className="mb-1 text-[11px] text-gray-500">Los campos de fábrica de este recuadro siguen igual; aquí van los que agregues.</p>}
                      {t.campos.length === 0 && <p className="text-xs text-gray-500">Sin campos agregados.</p>}
                      <ul className="space-y-1">
                        {t.campos.map((f, k) => (
                          <FilaCampo
                            key={f.id}
                            f={f}
                            primero={k === 0}
                            ultimo={k === t.campos.length - 1}
                            onSubir={() => onCampos(i, (cs) => intercambiar(cs, k, k - 1))}
                            onBajar={() => onCampos(i, (cs) => intercambiar(cs, k, k + 1))}
                            onGuardar={(cambio) => onCampos(i, (cs) => cs.map((x) => (x.id === f.id ? { ...x, ...cambio } : x)))}
                            onQuitar={() => onQuitarCampo(i, f)}
                          />
                        ))}
                      </ul>
                      <NuevoCampo
                        key={t.campos.length}
                        nombres={t.campos.map((f) => f.etiqueta.toLowerCase())}
                        onAgregar={(nuevo) => onCampos(i, (cs) => [...cs, { id: nuevoId(), usos: 0, todos: false, nuevo: true, ...nuevo }])}
                        onCancelar={() => setPanel(null)}
                      />
                    </div>
                  )}
                  {panel.tipo === "recuadro" && (
                    <NuevoRecuadro
                      items={items}
                      posicionInicial={i + 1}
                      onAgregar={(d) => {
                        onAgregarRecuadro(d);
                        setPanel(null);
                      }}
                      onCancelar={() => setPanel(null)}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function intercambiar<T>(lista: T[], a: number, b: number): T[] {
  if (b < 0 || b >= lista.length) return lista;
  const copia = [...lista];
  [copia[a], copia[b]] = [copia[b], copia[a]];
  return copia;
}
