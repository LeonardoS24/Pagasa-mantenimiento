"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useFormState, useFormStatus } from "react-dom";
import {
  consultarCopiaExterna,
  copiarAExternoAhora,
  guardarDestinoExterno,
  probarRestauracionAhora,
} from "@/actions/backup-actions";
import type { ActionState } from "@/actions/user-actions";
import type {
  EstadoGuardado,
  Progreso,
  ResultadoCopiaExterna,
  ResultadoPrueba,
  UnidadDisponible,
} from "@/lib/respaldo-externo";

const NOMBRES_CONTEO: Record<string, string> = {
  usuarios: "Usuarios",
  ciudades: "Ciudades",
  unidades: "Unidades, estaciones y plantas",
  mantenimientos: "Mantenimientos",
  documentos: "Documentos",
  equipos: "Equipos",
  bitacorasDeEquipo: "Bitácoras de equipo",
  pruebasUltrasonido: "Pruebas de ultrasonido",
  cambiosDeValvulas: "Cambios de válvulas",
};

function bytes(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
      {pending ? "Guardando..." : "Guardar unidad"}
    </button>
  );
}

function DetalleResultado({ r }: { r: ResultadoCopiaExterna }) {
  return (
    <ul className="mt-2 space-y-1 text-xs text-gray-600">
      <li>Destino: <span className="font-mono">{r.destino}</span></li>
      {r.base && (
        <li>
          Base: {r.base.archivo} ({bytes(r.base.bytes)}) · integridad {r.base.integridad === "ok" ? "correcta" : r.base.integridad} ·{" "}
          {r.base.conteos.unidades} unidades, {r.base.conteos.mantenimientos} mantenimientos, {r.base.conteos.documentos} documentos
        </li>
      )}
      {r.archivos && (
        <li>
          Archivos: {r.archivos.totalOrigen.toLocaleString("es-MX")} en el sistema · {r.archivos.copiados.toLocaleString("es-MX")} copiados ahora (
          {bytes(r.archivos.bytesCopiados)}) · {r.archivos.yaEstaban.toLocaleString("es-MX")} ya estaban
          {r.archivos.faltantes > 0 && <span className="font-semibold text-red-700"> · {r.archivos.faltantes} faltantes</span>}
        </li>
      )}
      <li>Tardó {r.duracionSeg < 60 ? `${r.duracionSeg} s` : `${Math.round(r.duracionSeg / 60)} min`}</li>
    </ul>
  );
}

export function CopiaExternaPanel({
  ruta,
  unidades,
  estadoInicial,
  progresoInicial,
  horasParaAviso,
}: {
  ruta: string | null;
  unidades: UnidadDisponible[];
  estadoInicial: EstadoGuardado;
  progresoInicial: Progreso;
  horasParaAviso: number;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState(estadoInicial);
  const [progreso, setProgreso] = useState(progresoInicial);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prueba, setPrueba] = useState<ResultadoPrueba | null>(null);
  const [probando, startProbar] = useTransition();
  const [formState, formAction] = useFormState<ActionState, FormData>(guardarDestinoExterno, {});
  const enLista = ruta ? unidades.some((u) => u.ruta === ruta) : false;
  const [eleccion, setEleccion] = useState<string>(ruta ? (enLista ? ruta : "otra") : "");

  // Mientras hay una copia en curso, se pregunta el avance cada 2 segundos.
  useEffect(() => {
    if (!progreso.enCurso) return;
    const t = window.setInterval(async () => {
      const r = await consultarCopiaExterna();
      setProgreso(r.progreso);
      setEstado(r.estado);
      if (!r.progreso.enCurso) {
        const u = r.estado.ultimo;
        if (u?.ok) setMensaje(u.mensaje);
        else if (u) setError(u.mensaje);
        router.refresh();
      }
    }, 2000);
    return () => window.clearInterval(t);
  }, [progreso.enCurso, router]);

  const ultimoExito = estado.ultimoExito;
  const horas = ultimoExito ? (Date.now() - new Date(ultimoExito.fecha).getTime()) / 3_600_000 : Infinity;
  const alDia = horas < horasParaAviso;

  return (
    <div className="mb-8 space-y-5 rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-primary">Copia de seguridad servidor</h2>
          <p className="text-sm text-gray-600">
            Copia de la base y de todos los archivos a una memoria USB o disco conectado a este equipo. Se hace sola una vez al
            día; si la memoria no estaba conectada, se hace en cuanto se conecte.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            !ruta ? "bg-gray-100 text-gray-700" : alDia ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {!ruta ? "Sin configurar" : alDia ? "Al día" : ultimoExito ? "Copia atrasada" : "Sin copia todavía"}
        </span>
      </div>

      {ruta && !alDia && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {ultimoExito
            ? `La última copia buena es del ${fechaHora(ultimoExito.fecha)}. Revisa que la memoria esté conectada y pulsa "Copiar ahora".`
            : `Todavía no hay ninguna copia buena en la memoria. Conéctala y pulsa "Copiar ahora".`}
        </p>
      )}

      {/* Estado */}
      {ultimoExito && (
        <div className="rounded-md bg-slate-50 p-3 text-sm">
          <p className="font-medium text-ink">Última copia correcta: {fechaHora(ultimoExito.fecha)}</p>
          <DetalleResultado r={ultimoExito} />
        </div>
      )}
      {estado.ultimo && !estado.ultimo.ok && (
        <div className="rounded-md border border-orange-300 bg-orange-50 p-3 text-sm text-orange-900">
          <p className="font-medium">Último intento ({fechaHora(estado.ultimo.fecha)}): no se pudo.</p>
          <p>{estado.ultimo.mensaje}</p>
        </div>
      )}

      {/* Acciones */}
      {ruta && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={progreso.enCurso}
              onClick={async () => {
                setMensaje(null);
                setError(null);
                const r = await copiarAExternoAhora();
                if (r.error) setError(r.error);
                else setProgreso({ ...progreso, enCurso: true, fase: "Preparando", archivosHechos: 0, archivosTotales: 0 });
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
            >
              {progreso.enCurso ? "Copiando..." : "Copiar ahora"}
            </button>
            <button
              type="button"
              disabled={probando || progreso.enCurso}
              onClick={() => {
                setPrueba(null);
                startProbar(async () => setPrueba(await probarRestauracionAhora()));
              }}
              className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-60"
            >
              {probando ? "Probando..." : "Probar restauración"}
            </button>
          </div>

          {progreso.enCurso && (
            <div className="text-sm text-ink">
              <p>
                {progreso.fase}
                {progreso.archivosTotales > 0 &&
                  ` · ${progreso.archivosHechos.toLocaleString("es-MX")} de ${progreso.archivosTotales.toLocaleString("es-MX")} archivos`}
              </p>
              <div className="mt-1 h-2 w-full overflow-hidden rounded bg-gray-200">
                <div
                  className="h-2 bg-accent transition-all"
                  style={{ width: `${progreso.archivosTotales ? Math.round((progreso.archivosHechos / progreso.archivosTotales) * 100) : 5}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">La primera copia tarda varios minutos. Puedes salir de esta página: sigue sola.</p>
            </div>
          )}
          {mensaje && <p className="text-sm text-green-700">{mensaje}</p>}
          {error && <p className="text-sm text-red-600">{error}</p>}

          {prueba && (
            <div className={`rounded-md border p-3 text-sm ${prueba.ok ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900"}`}>
              <p className="font-medium">{prueba.mensaje}</p>
              {prueba.conteosCopia && prueba.conteosVivos && (
                <table className="mt-2 w-full max-w-md text-xs">
                  <thead>
                    <tr className="text-left">
                      <th className="py-1 pr-2">Registro</th>
                      <th className="py-1 pr-2 text-right">En la copia</th>
                      <th className="py-1 text-right">En el sistema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(prueba.conteosCopia).map(([k, v]) => (
                      <tr key={k} className="border-t border-black/5">
                        <td className="py-1 pr-2">{NOMBRES_CONTEO[k] ?? k}</td>
                        <td className="py-1 pr-2 text-right">{v.toLocaleString("es-MX")}</td>
                        <td className="py-1 text-right">{prueba.conteosVivos![k as keyof typeof prueba.conteosVivos].toLocaleString("es-MX")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {prueba.muestraArchivos && (
                <p className="mt-2 text-xs">
                  Archivos comparados byte por byte: {prueba.muestraArchivos.iguales} de {prueba.muestraArchivos.revisados} iguales.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Elegir la unidad */}
      <form action={formAction} className="space-y-3 border-t border-gray-100 pt-4">
        <p className="text-sm font-medium text-ink">¿Dónde se guarda la copia?</p>
        {unidades.length === 0 && (
          <p className="text-sm text-gray-600">No se detectó ninguna memoria o disco además del sistema. Conecta la memoria y recarga la página.</p>
        )}
        <div className="space-y-2">
          {unidades.map((u) => (
            <label key={u.ruta} className={`flex items-start gap-2 text-sm ${u.esDelSistema ? "text-gray-400" : "text-ink"}`}>
              <input
                type="radio"
                name="unidad"
                value={u.ruta}
                disabled={u.esDelSistema}
                checked={eleccion === u.ruta}
                onChange={() => setEleccion(u.ruta)}
                className="mt-1"
              />
              <span>
                <span className="font-mono font-medium">{u.ruta}</span>
                {u.etiqueta && ` ${u.etiqueta}`} ·{" "}
                {u.tipo === "removible" ? "memoria USB" : u.tipo === "local" ? "disco" : u.tipo === "red" ? "unidad de red" : "unidad"} · {bytes(u.libreBytes)} libres de{" "}
                {bytes(u.totalBytes)}
                {u.esDelSistema && " · es el disco del sistema: no protege si falla"}
              </span>
            </label>
          ))}
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="radio" name="unidad" value="otra" checked={eleccion === "otra"} onChange={() => setEleccion("otra")} className="mt-1" />
            <span className="flex-1">
              Otra ruta
              <input
                type="text"
                name="rutaManual"
                defaultValue={ruta && !enLista ? ruta : ""}
                placeholder="E:\  o  \\NAS\respaldos"
                onFocus={() => setEleccion("otra")}
                className="mt-1 block w-full max-w-sm rounded-md border border-gray-300 px-3 py-1.5 font-mono text-sm"
              />
            </span>
          </label>
        </div>
        <p className="text-xs text-gray-500">
          Dentro de la unidad se crea la carpeta <span className="font-mono">Copia de seguridad servidor</span>. Usa una memoria de por lo
          menos el doble de lo que ocupan los datos (arriba, en &quot;Espacio que ocupa el sistema&quot;).
        </p>
        <div className="flex flex-wrap gap-2">
          <Guardar />
          {ruta && (
            <button type="submit" name="quitar" value="1" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-ink hover:bg-gray-50">
              Dejar de copiar
            </button>
          )}
        </div>
        {formState.error && <p className="text-sm text-red-600">{formState.error}</p>}
        {formState.success && <p className="text-sm text-green-700">{formState.success}</p>}
      </form>
    </div>
  );
}
