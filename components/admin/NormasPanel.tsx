"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import {
  agregarRequisito,
  guardarNormasVigentes,
  guardarRequisito,
  quitarRequisito,
  reponerRequisito,
  restablecerRequisito,
  type NormaVigenteEntrada,
} from "@/actions/requisitos-actions";
import type { ActionState } from "@/actions/user-actions";
import type { NormaVigente, RequisitoVigente, avisosDeVigencia } from "@/lib/requisitos-normativos";
import { FormMessage } from "./FormMessage";
import { ConContrasena } from "./ConContrasena";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function Guardar({ texto = "Guardar" }: { texto?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : texto}
    </button>
  );
}

function Restablecer({ clave }: { clave: string }) {
  const [state, formAction] = useFormState(restablecerRequisito.bind(null, clave), initialState);
  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!window.confirm("¿Volver a los valores base del catálogo? Se pierden tus cambios en este requisito.")) {
          e.preventDefault();
        }
      }}
      className="flex items-center gap-2"
    >
      <button type="submit" className="text-xs text-red-600 hover:underline">
        Restablecer valores base
      </button>
      {state.error && <FormMessage state={state} />}
    </form>
  );
}

function Campo({
  id,
  etiqueta,
  name,
  defaultValue,
  required,
}: {
  id: string;
  etiqueta: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink" htmlFor={id}>
        {etiqueta}
      </label>
      <input id={id} name={name} defaultValue={defaultValue} required={required} className={inputClass} />
    </div>
  );
}

function Tarjeta({ r }: { r: RequisitoVigente }) {
  const [state, formAction] = useFormState(guardarRequisito.bind(null, r.clave), initialState);
  const id = `req-${r.clave}`;

  // Restablecer y Quitar son OTROS formularios: HTML no permite formularios
  // anidados (el navegador ignora el de adentro y el clic terminaba
  // guardando), por eso van fuera del de guardar, como hermanos.
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <form action={formAction} className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-primary">{r.nombre}</h3>
            <p className="text-xs text-gray-500">
              {r.aplicaA}
              {r.cuentaDesde !== "—" && <> · se cuenta desde: {r.cuentaDesde.toLowerCase()}</>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {r.propio && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-800">Agregado</span>}
            {r.ajustado && <span className="rounded-full bg-accent-light/20 px-2 py-0.5 text-accent">Ajustado</span>}
            {r.verificado ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">Cotejado con el texto oficial</span>
            ) : (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Pendiente de cotejar</span>
            )}
          </div>
        </div>

        <details className="rounded-md border border-dashed border-gray-300 px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-primary">Cambiar nombre, a qué aplica y nota</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <Campo id={`${id}-nombre`} etiqueta="Nombre" name="nombre" defaultValue={r.nombre} required={r.propio} />
            <Campo id={`${id}-aplica`} etiqueta="Aplica a" name="aplicaA" defaultValue={r.aplicaA} required={r.propio} />
            <Campo id={`${id}-desde`} etiqueta="Se cuenta desde" name="cuentaDesde" defaultValue={r.cuentaDesde} />
          </div>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`${id}-nota`}>
              Nota (cómo lo aplica el sistema)
            </label>
            <textarea id={`${id}-nota`} name="nota" defaultValue={r.nota ?? ""} rows={2} className={inputClass} />
          </div>
        </details>

        <div className="grid gap-3 sm:grid-cols-3">
          <Campo id={`${id}-norma`} etiqueta="Norma" name="norma" defaultValue={r.norma} />
          <Campo id={`${id}-numeral`} etiqueta="Numeral o tabla" name="numeral" defaultValue={r.numeral} />
          {r.plazoClave ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`${id}-plazo`}>
                Plazo (años)
                {r.plazoBase !== null && <span className="ml-1 font-normal text-gray-500">base: {r.plazoBase}</span>}
              </label>
              <input
                id={`${id}-plazo`}
                name="plazoAnios"
                type="number"
                min={1}
                max={30}
                required
                defaultValue={r.plazoAnios ?? ""}
                className={inputClass}
              />
            </div>
          ) : r.propio ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`${id}-plazo`}>
                Plazo de referencia (años, opcional)
              </label>
              <input
                id={`${id}-plazo`}
                name="plazoAnios"
                type="number"
                min={1}
                max={50}
                defaultValue={r.plazoAnios ?? ""}
                className={inputClass}
              />
            </div>
          ) : (
            <div className="flex items-end text-xs text-gray-500">Sin plazo: solo referencia (no mueve alertas).</div>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`${id}-cita`}>
            Lo que dice la norma
          </label>
          <textarea id={`${id}-cita`} name="cita" defaultValue={r.cita} rows={3} className={`${inputClass} font-serif italic`} />
        </div>

        {r.nota && <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-gray-600">{r.nota}</p>}

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" name="verificado" defaultChecked={r.verificado} className="h-4 w-4" />
          Ya lo cotejé con el texto oficial (DOF)
        </label>

        <FormMessage state={state} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Guardar />
          {r.actualizadoPor && r.actualizadoEl && (
            <p className="text-xs text-gray-500">
              Última edición: {r.actualizadoPor}, {new Date(r.actualizadoEl).toLocaleDateString("es-MX")}
            </p>
          )}
        </div>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-gray-100 pt-3">
        {r.ajustado && <Restablecer clave={r.clave} />}
        <ConContrasena
          texto={r.propio ? "Eliminar" : "Quitar del catálogo"}
          confirmar={r.propio ? "Eliminar" : "Quitar"}
          peligro
          aviso={
            r.propio
              ? "Se borra este término de referencia. Las alertas agregadas que lo citaban se quedan sin fundamento."
              : r.plazoClave
                ? "Deja de salir en el catálogo y como fundamento. Su plazo y su alerta siguen igual (para apagar la alerta ve a Alertas → Configurar alertas). Lo puedes volver a poner."
                : "Deja de salir en el catálogo y como fundamento. Lo puedes volver a poner."
          }
          accion={(password) => quitarRequisito(r.clave, password)}
        />
      </div>
    </div>
  );
}

function NuevoRequisito() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
          setMensaje(null);
        }}
        className="rounded-lg border-2 border-dashed border-primary/40 px-4 py-3 text-sm font-medium text-primary hover:bg-primary/5"
      >
        + Agregar término de referencia
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={async (e) => {
        e.preventDefault();
        setEnviando(true);
        setMensaje(null);
        try {
          const r = await agregarRequisito(new FormData(e.currentTarget));
          if (!r.ok) setMensaje({ ok: false, texto: r.error });
          else {
            formRef.current?.reset();
            setAbierto(false);
            router.refresh();
          }
        } finally {
          setEnviando(false);
        }
      }}
      className="space-y-3 rounded-lg border-2 border-primary/30 bg-white p-5"
    >
      <h3 className="text-sm font-semibold text-primary">Nuevo término de referencia</h3>
      <p className="text-xs text-gray-500">
        Lo que pide una norma (nueva o que cambió). Sale en este catálogo y lo puedes usar como fundamento de una alerta
        agregada en Alertas → Configurar alertas.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo id="nuevo-nombre" etiqueta="Nombre (qué se revisa o cambia)" name="nombre" required />
        <Campo id="nuevo-aplica" etiqueta="Aplica a" name="aplicaA" required />
        <Campo id="nuevo-norma" etiqueta="Norma" name="norma" required />
        <Campo id="nuevo-numeral" etiqueta="Numeral o tabla" name="numeral" required />
        <Campo id="nuevo-desde" etiqueta="Se cuenta desde (opcional)" name="cuentaDesde" />
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor="nuevo-plazo">
            Plazo de referencia en años (opcional)
          </label>
          <input id="nuevo-plazo" name="plazoAnios" type="number" min={1} max={50} className={inputClass} />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor="nuevo-cita">
          Lo que dice la norma
        </label>
        <textarea id="nuevo-cita" name="cita" rows={3} required className={`${inputClass} font-serif italic`} />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor="nuevo-nota">
          Nota (opcional)
        </label>
        <textarea id="nuevo-nota" name="nota" rows={2} className={inputClass} />
      </div>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="verificado" className="h-4 w-4" />
        Ya lo cotejé con el texto oficial (DOF)
      </label>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor="nuevo-clave">
          Tu contraseña para confirmar
        </label>
        <input id="nuevo-clave" name="password" type="password" required autoComplete="current-password" className={`${inputClass} max-w-xs`} />
      </div>
      {mensaje && <p className={`text-sm ${mensaje.ok ? "text-green-700" : "text-red-700"}`}>{mensaje.texto}</p>}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {enviando ? "Guardando..." : "Agregar"}
        </button>
        <button type="button" onClick={() => setAbierto(false)} className="text-sm text-ink hover:underline">
          Cancelar
        </button>
      </div>
    </form>
  );
}

function NormasVigentesEditor({ normas }: { normas: NormaVigente[] }) {
  const inicial = (): NormaVigenteEntrada[] =>
    normas.map((n) => ({ clave: n.clave, area: n.area, norma: n.norma, detalle: n.detalle, vigenteHasta: n.vigenteHasta ?? "" }));
  const [editando, setEditando] = useState(false);
  const [lista, setLista] = useState<NormaVigenteEntrada[]>(inicial);

  const cambiar = (i: number, campo: keyof NormaVigenteEntrada, valor: string) =>
    setLista((l) => l.map((n, j) => (j === i ? { ...n, [campo]: valor } : n)));

  if (!editando) {
    return (
      <>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <tbody>
              {normas.map((n) => (
                <tr key={n.clave} className="border-b border-gray-100 align-top last:border-0">
                  <td className="px-4 py-2 font-medium text-ink">{n.area}</td>
                  <td className="whitespace-nowrap px-4 py-2 font-semibold text-primary">{n.norma}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {n.detalle}
                    {n.vigenteHasta && (
                      <span className="mt-1 block font-medium text-primary">Vigente hasta el {n.vigenteHasta}, salvo prórroga.</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          onClick={() => {
            setLista(inicial());
            setEditando(true);
          }}
          className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
        >
          Editar, agregar o quitar normas
        </button>
      </>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-white p-4">
      <p className="text-xs text-gray-500">
        Cuando salga una norma nueva (la definitiva que sustituye a una de emergencia, una prórroga...), cámbiala aquí. La
        fecha «vigente hasta» solo se llena en las de emergencia: el sistema avisa 60 días antes.
      </p>
      {lista.map((n, i) => (
        <div key={n.clave || i} className="grid gap-2 rounded-md border border-gray-200 p-3 sm:grid-cols-[1fr_1fr_10rem_auto]">
          <input value={n.area} onChange={(e) => cambiar(i, "area", e.target.value)} placeholder="Área que rige" className={inputClass} />
          <input value={n.norma} onChange={(e) => cambiar(i, "norma", e.target.value)} placeholder="Norma" className={inputClass} />
          <input
            type="date"
            value={n.vigenteHasta}
            onChange={(e) => cambiar(i, "vigenteHasta", e.target.value)}
            title="Vigente hasta (solo normas de emergencia)"
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setLista((l) => l.filter((_, j) => j !== i))}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
          >
            Quitar
          </button>
          <textarea
            value={n.detalle}
            onChange={(e) => cambiar(i, "detalle", e.target.value)}
            placeholder="Detalle (publicación en el DOF, vigencia, qué sustituye...)"
            rows={2}
            className={`${inputClass} sm:col-span-4`}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setLista((l) => [...l, { clave: "", area: "", norma: "", detalle: "", vigenteHasta: "" }])}
        className="rounded-md border border-dashed border-primary/50 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
      >
        + Agregar norma
      </button>
      <div className="flex flex-wrap items-start gap-3 border-t border-gray-100 pt-3">
        <ConContrasena
          texto="Guardar normas"
          confirmar="Guardar"
          accion={(password) => guardarNormasVigentes(lista, password)}
          alTerminar={() => setEditando(false)}
        />
        <button type="button" onClick={() => setEditando(false)} className="text-sm text-ink hover:underline">
          Cancelar
        </button>
      </div>
    </div>
  );
}

export type CambioDeCatalogo = { id: string; fecha: string; usuario: string; requisito: string; detalle: string | null };

export function NormasPanel({
  requisitos,
  normas,
  historial,
  avisos,
}: {
  requisitos: RequisitoVigente[];
  normas: NormaVigente[];
  historial: CambioDeCatalogo[];
  avisos: ReturnType<typeof avisosDeVigencia>;
}) {
  const visibles = requisitos.filter((r) => !r.oculto);
  const conAlerta = visibles.filter((r) => r.plazoClave);
  const referencia = visibles.filter((r) => !r.plazoClave && !r.propio);
  const propios = visibles.filter((r) => r.propio);
  const quitados = requisitos.filter((r) => r.oculto);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-ink">
        <p className="font-medium text-primary">Cómo funciona</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Cambiar un <strong>plazo</strong> mueve las alertas de todas las ciudades al instante. No se modifica ninguna
            fecha guardada.
          </li>
          <li>
            La norma y la cita salen como fundamento en los avisos. Marca &quot;Ya lo cotejé&quot; solo cuando la hayas
            comparado con el texto oficial.
          </li>
          <li>
            Puedes <strong>agregar</strong> términos de referencia nuevos y <strong>quitar</strong> los que ya no apliquen
            (con tu contraseña). Para agregar o quitar <strong>alertas</strong>, ve a Alertas → Configurar alertas.
          </li>
          <li>Los ciclos de las pruebas del tanque (10 años la primera vez, 5 después) no se editan aquí.</li>
        </ul>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Normas que rigen hoy</h2>
        {avisos.map((a) => (
          <p
            key={a.clave}
            className={`rounded-md border px-3 py-2 text-sm ${
              a.nivel === "rojo" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            <strong>{a.norma}</strong>{" "}
            {a.dias < 0 ? `venció hace ${-a.dias} día(s)` : a.dias === 0 ? "vence hoy" : `vence en ${a.dias} día(s)`} (
            {a.vigenteHasta}). Revisa el DOF: si salió la prórroga, la norma definitiva o una de emergencia nueva, y
            actualiza esta lista y las citas de este catálogo.
          </p>
        ))}
        <NormasVigentesEditor normas={normas} />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Requisitos con alerta (plazo editable)</h2>
        {conAlerta.map((r) => (
          <Tarjeta key={r.clave} r={r} />
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Solo referencia (sin alerta o con otro cálculo)</h2>
        {referencia.map((r) => (
          <Tarjeta key={r.clave} r={r} />
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Términos de referencia agregados</h2>
        {propios.length === 0 && (
          <p className="text-sm text-gray-500">Todavía no se ha agregado ninguno.</p>
        )}
        {propios.map((r) => (
          <Tarjeta key={r.clave} r={r} />
        ))}
        <NuevoRequisito />
      </section>

      {quitados.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase text-primary-bright">Quitados del catálogo</h2>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm">
            {quitados.map((r) => (
              <li key={r.clave} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span className="text-ink">
                  <span className="font-medium">{r.nombre}</span>
                  <span className="text-gray-500"> · {r.norma}</span>
                </span>
                <ConContrasena
                  texto="Volver a poner"
                  confirmar="Volver a poner"
                  className="rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5"
                  accion={(password) => reponerRequisito(r.clave, password)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Historial de cambios del catálogo</h2>
        <p className="text-xs text-gray-500">
          Cada cambio de plazo, norma, numeral o cita, con fecha y quién lo hizo: sirve para saber con qué criterio
          calculaba el sistema en una fecha dada (por ejemplo, ante una auditoría).
        </p>
        {historial.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-ink">
            Sin cambios: el catálogo está con sus valores base.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white text-sm">
            {historial.map((h) => (
              <li key={h.id} className="px-4 py-2">
                <p className="text-ink">
                  <span className="font-medium text-primary">
                    {new Date(h.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  {" · "}
                  <span className="font-medium">{h.requisito}</span>
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
