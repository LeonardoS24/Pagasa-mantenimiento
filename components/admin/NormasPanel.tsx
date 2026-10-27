"use client";

import { useFormState, useFormStatus } from "react-dom";
import { guardarRequisito, restablecerRequisito } from "@/actions/requisitos-actions";
import type { ActionState } from "@/actions/user-actions";
import { NORMAS_VIGENTES, type RequisitoVigente, type avisosDeVigencia } from "@/lib/requisitos-normativos";
import { FormMessage } from "./FormMessage";

const initialState: ActionState = {};

const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
    >
      {pending ? "Guardando..." : "Guardar"}
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

function Tarjeta({ r }: { r: RequisitoVigente }) {
  const [state, formAction] = useFormState(guardarRequisito.bind(null, r.clave), initialState);
  const id = `req-${r.clave}`;

  // Restablecer es OTRO formulario: HTML no permite formularios anidados (el
  // navegador ignora el de adentro y el clic terminaba guardando), por eso va
  // fuera del de guardar, como hermano.
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
          {r.ajustado && <span className="rounded-full bg-accent-light/20 px-2 py-0.5 text-accent">Ajustado</span>}
          {r.verificado ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-800">Cotejado con el texto oficial</span>
          ) : (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Pendiente de cotejar</span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`${id}-norma`}>
            Norma
          </label>
          <input id={`${id}-norma`} name="norma" defaultValue={r.norma} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`${id}-numeral`}>
            Numeral o tabla
          </label>
          <input id={`${id}-numeral`} name="numeral" defaultValue={r.numeral} className={inputClass} />
        </div>
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
        ) : (
          <div className="flex items-end text-xs text-gray-500">Sin plazo: solo referencia (no mueve alertas).</div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink" htmlFor={`${id}-cita`}>
          Lo que dice la norma
        </label>
        <textarea
          id={`${id}-cita`}
          name="cita"
          defaultValue={r.cita}
          rows={3}
          className={`${inputClass} font-serif italic`}
        />
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
    {r.ajustado && (
      <div className="mt-3 border-t border-gray-100 pt-3">
        <Restablecer clave={r.clave} />
      </div>
    )}
    </div>
  );
}

export type CambioDeCatalogo = { id: string; fecha: string; usuario: string; requisito: string; detalle: string | null };

export function NormasPanel({
  requisitos,
  historial,
  avisos,
}: {
  requisitos: RequisitoVigente[];
  historial: CambioDeCatalogo[];
  avisos: ReturnType<typeof avisosDeVigencia>;
}) {
  const conAlerta = requisitos.filter((r) => r.plazoClave);
  const referencia = requisitos.filter((r) => !r.plazoClave);

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-ink">
        <p className="font-medium text-primary">Cómo funciona</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>
            Cambiar un <strong>plazo</strong> mueve las alertas de todas las ciudades al instante. No se modifica
            ninguna fecha guardada.
          </li>
          <li>
            La norma y la cita salen como fundamento en los avisos. Marca &quot;Ya lo cotejé&quot; solo cuando la
            hayas comparado con el texto oficial.
          </li>
          <li>Los ciclos de las pruebas del tanque (10 años la primera vez, 5 después) no se editan aquí.</li>
        </ul>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Normas que rigen hoy</h2>
        {avisos.map((a) => (
          <p
            key={a.norma}
            className={`rounded-md border px-3 py-2 text-sm ${
              a.nivel === "rojo" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            <strong>{a.norma}</strong>{" "}
            {a.dias < 0
              ? `venció hace ${-a.dias} día(s)`
              : a.dias === 0
                ? "vence hoy"
                : `vence en ${a.dias} día(s)`}{" "}
            ({a.vigenteHasta}). Revisa el DOF: si salió la prórroga, la norma definitiva o una de emergencia nueva, y
            actualiza las citas de este catálogo.
          </p>
        ))}
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-left text-sm">
            <tbody>
              {NORMAS_VIGENTES.map((n) => (
                <tr key={n.area} className="border-b border-gray-100 align-top last:border-0">
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
        <p className="text-xs text-gray-500">
          Cotejadas con el texto publicado en el DOF (21-oct-2026). Estaciones de carburación revisado el 27-oct-2026: la
          NOM-012-ASEA-2021 sigue siendo proyecto, por eso rige la NOM-003-SEDG-2004.
        </p>
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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase text-primary-bright">Historial de cambios del catálogo</h2>
        <p className="text-xs text-gray-500">
          Cada cambio de plazo, norma, numeral o cita, con fecha y quién lo hizo: sirve para saber con qué criterio calculaba
          el sistema en una fecha dada (por ejemplo, ante una auditoría).
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
                  <span className="font-medium text-primary">{new Date(h.fecha).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}</span>
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
