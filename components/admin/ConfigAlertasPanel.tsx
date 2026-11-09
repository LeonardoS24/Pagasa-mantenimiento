"use client";

import { useState } from "react";
import {
  eliminarAlertaPropia,
  guardarAlertaDeFabrica,
  guardarAlertaPropia,
  type EntradaAlertaPropia,
} from "@/actions/alertas-config-actions";
import { ConContrasena } from "./ConContrasena";

// Administración → Alertas → Configurar alertas. Ver lib/alertas-catalogo.ts.

type Fabrica = { tipo: string; nombreDeFabrica: string; nombre: string; descripcion: string; activa: boolean };
type Fuente = "FICHA" | "CAMPO" | "REGISTRO";
type Propia = {
  id: string;
  nombre: string;
  apartados: string[];
  fuente: Fuente;
  fuenteClave: string;
  modo: "VENCE" | "PLAZO";
  plazoAnios: number;
  plazoMeses: number;
  diasAviso: number;
  requisitoClave: string | null;
  activa: boolean;
  creadoPor: string | null;
  conteo: { rojo: number; amarillo: number; total: number };
};
type Opciones = {
  apartados: { slug: string; nombre: string }[];
  camposFicha: { campo: string; nombre: string }[];
  registros: { clave: string; nombre: string }[];
  camposPropios: { id: string; etiqueta: string; apartado: string }[];
  requisitos: { clave: string; nombre: string; norma: string; plazoAnios: number | null }[];
};
type Cambio = { id: string; fecha: string; usuario: string; resumen: string; detalle: string | null };

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function FilaDeFabrica({ a }: { a: Fabrica }) {
  const [nombre, setNombre] = useState(a.nombre);
  const cambioNombre = nombre.trim() !== a.nombre;
  return (
    <li className={`space-y-2 px-4 py-3 ${a.activa ? "" : "bg-gray-50"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          aria-label="Nombre de la alerta"
          className={`${inputClass} max-w-xl flex-1 ${a.activa ? "" : "text-gray-500 line-through"}`}
        />
        {a.activa ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Activa</span>
        ) : (
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">Quitada</span>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {a.descripcion}
        {a.nombre !== a.nombreDeFabrica && <> · Nombre original: «{a.nombreDeFabrica}»</>}
      </p>
      <div className="flex flex-wrap items-start gap-2">
        {cambioNombre && (
          <ConContrasena
            texto="Guardar nombre"
            confirmar="Guardar"
            accion={(password) => guardarAlertaDeFabrica(a.tipo, { nombre, activa: a.activa }, password)}
          />
        )}
        {a.activa ? (
          <ConContrasena
            texto="Quitar alerta"
            confirmar="Quitar"
            peligro
            aviso="Deja de avisar en Inicio, en cada ciudad, en el calendario, en el tablero y en los correos. Los datos de las unidades no se tocan y la puedes volver a poner."
            accion={(password) => guardarAlertaDeFabrica(a.tipo, { nombre, activa: false }, password)}
          />
        ) : (
          <ConContrasena
            texto="Volver a poner"
            confirmar="Volver a poner"
            className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
            accion={(password) => guardarAlertaDeFabrica(a.tipo, { nombre, activa: true }, password)}
          />
        )}
      </div>
    </li>
  );
}

const VACIA: EntradaAlertaPropia = {
  nombre: "",
  apartados: [],
  fuente: "FICHA",
  fuenteClave: "",
  modo: "PLAZO",
  plazoAnios: 1,
  plazoMeses: 0,
  diasAviso: 30,
  requisitoClave: null,
  activa: true,
};

function FormularioAlerta({
  inicial,
  id,
  opciones,
  alTerminar,
}: {
  inicial: EntradaAlertaPropia;
  id: string | null;
  opciones: Opciones;
  alTerminar: () => void;
}) {
  const [d, setD] = useState<EntradaAlertaPropia>(inicial);
  const poner = <K extends keyof EntradaAlertaPropia>(campo: K, valor: EntradaAlertaPropia[K]) => setD((x) => ({ ...x, [campo]: valor }));
  const fuente = d.fuente as Fuente;

  const listaFuente =
    fuente === "FICHA"
      ? opciones.camposFicha.map((c) => ({ valor: c.campo, texto: c.nombre }))
      : fuente === "REGISTRO"
        ? opciones.registros.map((r) => ({ valor: r.clave, texto: r.nombre }))
        : opciones.camposPropios.map((c) => ({ valor: c.id, texto: `${c.etiqueta} (${c.apartado})` }));

  return (
    <div className="space-y-4 rounded-lg border-2 border-primary/30 bg-white p-5">
      <h3 className="text-sm font-semibold text-primary">{id ? "Editar alerta" : "Nueva alerta"}</h3>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`al-nombre-${id ?? "nueva"}`}>
          1. Nombre de la alerta (lo que se revisa o se cambia)
        </label>
        <input
          id={`al-nombre-${id ?? "nueva"}`}
          value={d.nombre}
          onChange={(e) => poner("nombre", e.target.value)}
          placeholder="Ej.: Calibración del manómetro"
          className={inputClass}
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-xs font-medium text-ink">2. ¿En qué apartados avisa?</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {opciones.apartados.map((a) => (
            <label key={a.slug} className="flex items-center gap-1.5 text-sm text-ink">
              <input
                type="checkbox"
                checked={d.apartados.includes(a.slug)}
                onChange={(e) =>
                  poner("apartados", e.target.checked ? [...d.apartados, a.slug] : d.apartados.filter((x) => x !== a.slug))
                }
                className="h-4 w-4"
              />
              {a.nombre}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium text-ink">3. ¿De dónde sale la fecha?</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink">
          {(
            [
              ["FICHA", "Un dato de la ficha técnica"],
              ["CAMPO", "Un campo que agregaste (tipo fecha)"],
              ["REGISTRO", "El último registro de una bitácora"],
            ] as const
          ).map(([valor, texto]) => (
            <label key={valor} className="flex items-center gap-1.5">
              <input
                type="radio"
                name={`fuente-${id ?? "nueva"}`}
                checked={fuente === valor}
                onChange={() => setD((x) => ({ ...x, fuente: valor, fuenteClave: "" }))}
              />
              {texto}
            </label>
          ))}
        </div>
        {fuente === "CAMPO" && opciones.camposPropios.length === 0 ? (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Todavía no hay campos agregados de tipo fecha. Agrégalo primero en Editar sistema (por ejemplo «Fecha de
            calibración» en el recuadro que quieras) y luego vuelve aquí.
          </p>
        ) : (
          <select value={d.fuenteClave} onChange={(e) => poner("fuenteClave", e.target.value)} className={inputClass}>
            <option value="">— Elige —</option>
            {listaFuente.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.texto}
              </option>
            ))}
          </select>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs font-medium text-ink">4. ¿Cuándo vence?</legend>
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input
            type="radio"
            name={`modo-${id ?? "nueva"}`}
            checked={d.modo === "PLAZO"}
            onChange={() => poner("modo", "PLAZO")}
          />
          Pasado un tiempo desde esa fecha:
          <input
            type="number"
            min={0}
            max={50}
            value={d.plazoAnios}
            disabled={d.modo !== "PLAZO"}
            onChange={(e) => poner("plazoAnios", Number(e.target.value) || 0)}
            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
          />
          años y
          <input
            type="number"
            min={0}
            max={11}
            value={d.plazoMeses}
            disabled={d.modo !== "PLAZO"}
            onChange={(e) => poner("plazoMeses", Number(e.target.value) || 0)}
            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm disabled:bg-gray-100"
          />
          meses
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink">
          <input type="radio" name={`modo-${id ?? "nueva"}`} checked={d.modo === "VENCE"} onChange={() => poner("modo", "VENCE")} />
          Esa fecha ya es el vencimiento
        </label>
        <label className="flex items-center gap-1.5 text-sm text-ink">
          Avisar en amarillo desde
          <input
            type="number"
            min={7}
            max={365}
            value={d.diasAviso}
            onChange={(e) => poner("diasAviso", Number(e.target.value) || 30)}
            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          días antes (en rojo a 7 días o menos).
        </label>
      </fieldset>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`al-req-${id ?? "nueva"}`}>
          5. Fundamento (opcional): término de referencia de Normas
        </label>
        <select
          id={`al-req-${id ?? "nueva"}`}
          value={d.requisitoClave ?? ""}
          onChange={(e) => poner("requisitoClave", e.target.value || null)}
          className={inputClass}
        >
          <option value="">— Sin fundamento —</option>
          {opciones.requisitos.map((r) => (
            <option key={r.clave} value={r.clave}>
              {r.nombre} · {r.norma}
            </option>
          ))}
        </select>
      </div>

      {id && (
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={d.activa} onChange={(e) => poner("activa", e.target.checked)} className="h-4 w-4" />
          Activa (si la desmarcas, queda en pausa y no avisa)
        </label>
      )}

      <div className="flex flex-wrap items-start gap-3 border-t border-gray-100 pt-3">
        <ConContrasena
          texto={id ? "Guardar cambios" : "Agregar alerta"}
          confirmar={id ? "Guardar" : "Agregar"}
          accion={(password) => guardarAlertaPropia(id, d, password)}
          alTerminar={alTerminar}
        />
        <button type="button" onClick={alTerminar} className="text-sm text-ink hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

function descripcionDe(p: Propia, opciones: Opciones): string {
  const fuente =
    p.fuente === "FICHA"
      ? opciones.camposFicha.find((c) => c.campo === p.fuenteClave)?.nombre
      : p.fuente === "REGISTRO"
        ? opciones.registros.find((r) => r.clave === p.fuenteClave)?.nombre
        : opciones.camposPropios.find((c) => c.id === p.fuenteClave)?.etiqueta;
  const cuando =
    p.modo === "VENCE"
      ? "esa fecha es el vencimiento"
      : `vence ${[p.plazoAnios ? `${p.plazoAnios} año(s)` : "", p.plazoMeses ? `${p.plazoMeses} mes(es)` : ""].filter(Boolean).join(" y ")} después`;
  return `Fecha: ${fuente ?? "(el campo ya no existe)"} · ${cuando} · aviso ${p.diasAviso} días antes`;
}

function FilaPropia({ p, opciones }: { p: Propia; opciones: Opciones }) {
  const [editando, setEditando] = useState(false);
  const apartados = p.apartados.map((s) => opciones.apartados.find((a) => a.slug === s)?.nombre ?? s).join(", ");
  const req = opciones.requisitos.find((r) => r.clave === p.requisitoClave);

  if (editando) {
    return (
      <li className="p-3">
        <FormularioAlerta
          id={p.id}
          inicial={{
            nombre: p.nombre,
            apartados: p.apartados,
            fuente: p.fuente,
            fuenteClave: p.fuenteClave,
            modo: p.modo,
            plazoAnios: p.plazoAnios,
            plazoMeses: p.plazoMeses,
            diasAviso: p.diasAviso,
            requisitoClave: p.requisitoClave,
            activa: p.activa,
          }}
          opciones={opciones}
          alTerminar={() => setEditando(false)}
        />
      </li>
    );
  }

  return (
    <li className={`space-y-1 px-4 py-3 ${p.activa ? "" : "bg-gray-50"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-primary">{p.nombre}</span>
        {p.activa ? (
          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">Activa</span>
        ) : (
          <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">En pausa</span>
        )}
        {p.activa && (
          <span className="text-xs text-gray-500">
            Hoy: {p.conteo.rojo} en rojo, {p.conteo.amarillo} en amarillo ({p.conteo.total} unidad(es) con la fecha capturada)
          </span>
        )}
      </div>
      <p className="text-xs text-ink">{descripcionDe(p, opciones)}</p>
      <p className="text-xs text-gray-500">
        Apartados: {apartados || "ninguno"}
        {req && <> · Fundamento: {req.norma}</>}
        {p.creadoPor && <> · Agregada por {p.creadoPor}</>}
      </p>
      <div className="flex flex-wrap items-start gap-2 pt-1">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
        >
          Editar o cambiar nombre
        </button>
        <ConContrasena
          texto="Eliminar"
          confirmar="Eliminar"
          peligro
          aviso="Se borra la alerta. Las fechas de las unidades no se tocan."
          accion={(password) => eliminarAlertaPropia(p.id, password)}
        />
      </div>
    </li>
  );
}

export function ConfigAlertasPanel({
  deFabrica,
  propias,
  opciones,
  historial,
}: {
  deFabrica: Fabrica[];
  propias: Propia[];
  opciones: Opciones;
  historial: Cambio[];
}) {
  const [agregando, setAgregando] = useState(false);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-ink">
        <p className="font-medium text-primary">Cómo funciona</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Todo cambio pide <strong>tu contraseña</strong> y queda en el historial de abajo y en la Actividad del sistema.
          </li>
          <li>
            <strong>Quitar</strong> una alerta la saca de Inicio, de cada ciudad, del calendario, del tablero y de los
            correos. No borra ningún dato y se puede volver a poner.
          </li>
          <li>
            Una <strong>alerta nueva</strong> vigila una fecha: un dato de la ficha, un campo que agregaste en Editar
            sistema (tipo fecha) o el último registro de una bitácora. Avisa en amarillo con los días que elijas y en rojo
            a 7 días o menos.
          </li>
          <li>
            Los <strong>plazos</strong> de las alertas de válvulas y mangueras se cambian en Normas y términos de
            referencia.
          </li>
        </ul>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Alertas agregadas</h2>
        {propias.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no se ha agregado ninguna alerta.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm">
            {propias.map((p) => (
              <FilaPropia key={p.id} p={p} opciones={opciones} />
            ))}
          </ul>
        )}
        {agregando ? (
          <FormularioAlerta id={null} inicial={VACIA} opciones={opciones} alTerminar={() => setAgregando(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            className="rounded-lg border-2 border-dashed border-primary/40 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/5"
          >
            + Agregar alerta
          </button>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Alertas del sistema</h2>
        <p className="text-xs text-gray-500">Cambia el nombre con el que salen o quítalas.</p>
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm">
          {deFabrica.map((a) => (
            <FilaDeFabrica key={a.tipo} a={a} />
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Historial de cambios de las alertas</h2>
        {historial.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-ink">Sin cambios todavía.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm">
            {historial.map((h) => (
              <li key={h.id} className="px-4 py-2">
                <p className="text-ink">
                  <span className="font-medium text-primary">
                    {new Date(h.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  {" · "}
                  <span className="font-medium">{h.resumen}</span>
                  <span className="text-gray-500"> · {h.usuario}</span>
                </p>
                {h.detalle && <p className="text-xs text-gray-600">{h.detalle}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
