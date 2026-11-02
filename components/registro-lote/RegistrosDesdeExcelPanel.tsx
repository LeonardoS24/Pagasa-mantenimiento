"use client";

import { useState, useTransition } from "react";
import { aplicarRegistrosExcel, revisarRegistrosExcel, type ResultadoUnidad } from "@/actions/registro-lote-actions";
import { CAMPOS_POR_TIPO, tipoLoteLabel, type TipoLote } from "@/lib/lote-documentos";
import type { FilaRegistro, ProblemaRegistro } from "@/lib/registros-excel";

function dmy(valor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

export function RegistrosDesdeExcelPanel({ citySlug }: { citySlug: string }) {
  const [filas, setFilas] = useState<FilaRegistro[] | null>(null);
  const [problemas, setProblemas] = useState<ProblemaRegistro[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [contrasena, setContrasena] = useState("");
  const [resultados, setResultados] = useState<ResultadoUnidad[] | null>(null);
  const [leyendo, empezarLeer] = useTransition();
  const [guardando, empezarGuardar] = useTransition();

  const tipos = filas ? (Array.from(new Set(filas.map((f) => f.tipo))) as TipoLote[]) : [];
  const guardados = resultados?.filter((r) => r.ok) ?? [];
  const fallados = resultados?.filter((r) => !r.ok) ?? [];

  function guardar() {
    if (!filas) return;
    setError(null);
    empezarGuardar(async () => {
      const r = await aplicarRegistrosExcel(citySlug, filas, contrasena);
      if (r.error) {
        setError(r.error);
        return;
      }
      const res = r.resultados ?? [];
      setResultados(res);
      setContrasena("");
      // Lo guardado sale de la lista; lo que falló se queda (con su motivo
      // abajo) y no se vuelve a mandar lo bueno.
      const falladas = new Set(res.filter((x) => !x.ok).map((x) => `${x.hoja}|${x.fila}`));
      const pendientes = filas.filter((f) => falladas.has(`${f.hoja}|${f.fila}`));
      setFilas(pendientes.length > 0 ? pendientes : null);
    });
  }

  const entrada = "rounded-md border border-gray-300 px-3 py-2 text-sm";

  return (
    <div className="space-y-4">
      <form
        action={(fd) => {
          setError(null);
          setResultados(null);
          setFilas(null);
          setProblemas([]);
          empezarLeer(async () => {
            const r = await revisarRegistrosExcel(citySlug, fd);
            if (r.error) setError(r.error);
            setProblemas(r.problemas);
            setFilas(r.filas.length > 0 ? r.filas : null);
            if (!r.error && r.filas.length === 0 && r.problemas.length === 0) {
              setError("No hay renglones con datos en las hojas del archivo. Llena al menos un registro.");
            }
          });
        }}
        className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-4"
      >
        <input type="file" name="archivo" accept=".xlsx,.xls" required className="text-sm" />
        <button type="submit" disabled={leyendo} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
          {leyendo ? "Leyendo..." : "Revisar registros"}
        </button>
      </form>

      {error && <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {problemas.length > 0 && (
        <div className="rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          <p className="font-medium">{problemas.length} renglón(es) con problema (no se guardarán; corrígelos en el Excel y vuelve a subirlo):</p>
          <ul className="max-h-60 list-disc overflow-auto pl-5">
            {problemas.slice(0, 100).map((p, i) => (
              <li key={i}>
                {p.hoja}, renglón {p.fila}: {p.mensaje}
              </li>
            ))}
          </ul>
          {problemas.length > 100 && <p>…y {problemas.length - 100} más.</p>}
        </div>
      )}

      {guardados.length > 0 && (
        <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          Se guardaron {guardados.length} registro(s). Quedaron en la bitácora de cada unidad y en la bitácora de actividad a tu nombre. Si vas a subir otro archivo,
          descarga una plantilla nueva: subir el mismo dos veces duplica los registros.
        </p>
      )}
      {fallados.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-medium">No se pudo guardar {fallados.length} registro(s):</p>
          <ul className="list-disc pl-5">
            {fallados.map((r, i) => (
              <li key={i}>
                {r.nombre}
                {r.tipo ? ` (${tipoLoteLabel[r.tipo as TipoLote] ?? r.tipo})` : ""}: {r.mensaje}
              </li>
            ))}
          </ul>
        </div>
      )}

      {filas && filas.length > 0 && (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            Se van a registrar {filas.length} registro(s) nuevo(s). Revisa cada uno antes de guardar:
          </p>
          {tipos.map((tipo) => {
            const defs = CAMPOS_POR_TIPO[tipo];
            const deEste = filas.filter((f) => f.tipo === tipo);
            return (
              <div key={tipo} className="rounded-md bg-white p-3">
                <p className="mb-2 text-sm font-medium text-ink">
                  {tipoLoteLabel[tipo]} ({deEste.length})
                </p>
                <div className="max-h-72 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="text-gray-500">
                      <tr>
                        <th className="py-1 pr-3">Unidad</th>
                        {defs.map((d) => (
                          <th key={d.campo} className="py-1 pr-3">
                            {d.etiqueta}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {deEste.map((f) => (
                        <tr key={`${f.hoja}-${f.fila}`} className="border-t border-gray-100 align-top">
                          <td className="py-1 pr-3 font-medium text-ink">{f.unidad}</td>
                          {defs.map((d) => {
                            const v = f.valores[d.campo] ?? "";
                            const opcion = d.opciones?.find((o) => o.valor === v)?.etiqueta;
                            return (
                              <td key={d.campo} className="py-1 pr-3">
                                {v ? (d.control === "fecha" ? dmy(v) : (opcion ?? v)) : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          <p className="text-sm text-amber-900">Cada uno queda como registro nuevo en la bitácora de su unidad (lo anterior se conserva como historial).</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="password"
              autoComplete="current-password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="Tu contraseña para confirmar"
              aria-label="Tu contraseña para confirmar"
              className={entrada}
            />
            <button type="button" onClick={guardar} disabled={guardando} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60">
              {guardando ? "Guardando..." : `Estoy de acuerdo, guardar ${filas.length}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
