"use client";

import { useState, useTransition } from "react";
import { aplicarFechas, previsualizarFechas } from "@/actions/carga-fechas-actions";
import type { CambioFecha, ProblemaCarga } from "@/lib/carga-fechas";

function fecha(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

export function CargaFechasPanel({ citySlug }: { citySlug: string }) {
  const [cambios, setCambios] = useState<CambioFecha[] | null>(null);
  const [problemas, setProblemas] = useState<ProblemaCarga[]>([]);
  const [filas, setFilas] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);
  const [omitidos, setOmitidos] = useState<string[]>([]);
  const [leyendo, startLeer] = useTransition();
  const [aplicando, startAplicar] = useTransition();

  const unidades = cambios ? new Set(cambios.map((c) => c.vehicleId)).size : 0;

  return (
    <div className="space-y-4">
      <form
        action={(fd) => {
          setError(null);
          setResultado(null);
          setOmitidos([]);
          setCambios(null);
          startLeer(async () => {
            const r = await previsualizarFechas(citySlug, fd);
            if (r.error) setError(r.error);
            setCambios(r.cambios);
            setProblemas(r.problemas);
            setFilas(r.filasLeidas);
          });
        }}
        className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <input type="file" name="archivo" accept=".xlsx,.xls" required className="text-sm" />
        <button type="submit" disabled={leyendo} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
          {leyendo ? "Leyendo..." : "Revisar cambios"}
        </button>
      </form>

      {error && <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {resultado && <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">{resultado}</p>}
      {omitidos.length > 0 && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">No se aplicaron {omitidos.length}:</p>
          <ul className="list-disc pl-5">
            {omitidos.slice(0, 30).map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        </div>
      )}

      {problemas.length > 0 && (
        <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          <p className="font-medium">{problemas.length} celda(s) o renglón(es) con problema (no se tomarán en cuenta):</p>
          <ul className="list-disc pl-5">
            {problemas.slice(0, 50).map((p, i) => (
              <li key={i}>
                {p.hoja && `${p.hoja}, renglón ${p.fila}: `}
                {p.mensaje}
              </li>
            ))}
          </ul>
          {problemas.length > 50 && <p>…y {problemas.length - 50} más.</p>}
        </div>
      )}

      {cambios && cambios.length === 0 && !error && (
        <p className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-ink">
          Se leyeron {filas} unidad(es) y no hay ninguna fecha distinta a la que ya tiene el sistema.
        </p>
      )}

      {cambios && cambios.length > 0 && (
        <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-ink">
              {cambios.length} fecha(s) cambian en {unidades} unidad(es). Revisa antes de aplicar.
            </p>
            <button
              type="button"
              disabled={aplicando}
              onClick={() =>
                startAplicar(async () => {
                  const r = await aplicarFechas(citySlug, cambios);
                  if (r.error) {
                    setError(r.error);
                    return;
                  }
                  setResultado(`Listo: se guardaron ${r.aplicados} fecha(s) en ${r.unidades} unidad(es). Quedó en la bitácora de actividad.`);
                  setOmitidos(r.omitidos);
                  setCambios(null);
                  setProblemas([]);
                })
              }
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              {aplicando ? "Guardando..." : `Aplicar ${cambios.length} cambio(s)`}
            </button>
          </div>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white text-left text-xs text-gray-500">
                <tr>
                  <th className="py-1 pr-3">Unidad</th>
                  <th className="py-1 pr-3">Fecha</th>
                  <th className="py-1 pr-3">Antes</th>
                  <th className="py-1">Después</th>
                </tr>
              </thead>
              <tbody>
                {cambios.map((c, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="py-1 pr-3 font-medium text-ink">
                      {c.numeroEconomico} <span className="text-xs font-normal text-gray-500">{c.apartado}</span>
                    </td>
                    <td className="py-1 pr-3">{c.etiqueta}</td>
                    <td className="py-1 pr-3 text-gray-500">{fecha(c.antes)}</td>
                    <td className={`py-1 font-medium ${c.despues ? "text-primary" : "text-red-700"}`}>{c.despues ? fecha(c.despues) : "Se borra"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
