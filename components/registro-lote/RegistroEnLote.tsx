"use client";

import { useMemo, useState, useTransition } from "react";
import { registrarEnLote, type ResultadoUnidad } from "@/actions/registro-lote-actions";
import { CAMPOS_POR_TIPO, tipoLoteLabel, type DefCampo, type TipoLote } from "@/lib/lote-documentos";

export type UnidadLote = { id: string; nombre: string; apartado: string; ciudad: string };

type Valores = Record<string, string>;

const entrada = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";

function dmy(valor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

function Control({
  def,
  valor,
  onCambio,
  marcador,
  etiquetaAria,
}: {
  def: DefCampo;
  valor: string;
  onCambio: (v: string) => void;
  marcador?: string;
  etiquetaAria?: string;
}) {
  const comunes = { value: valor, "aria-label": etiquetaAria ?? def.etiqueta, className: `${entrada} block w-full` };
  if (def.control === "opciones") {
    return (
      <select {...comunes} onChange={(e) => onCambio(e.target.value)}>
        <option value="">{marcador ?? "Elige…"}</option>
        {def.opciones?.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    );
  }
  if (def.control === "textoLargo") {
    return <textarea {...comunes} rows={2} placeholder={marcador} onChange={(e) => onCambio(e.target.value)} />;
  }
  return (
    <input
      {...comunes}
      type={def.control === "fecha" ? "date" : def.control === "numero" ? "number" : "text"}
      placeholder={marcador}
      onChange={(e) => onCambio(e.target.value)}
    />
  );
}

export function RegistroEnLote({ citySlug, tipo, unidades }: { citySlug: string; tipo: TipoLote; unidades: UnidadLote[] }) {
  const defs = CAMPOS_POR_TIPO[tipo];
  const [comunes, setComunes] = useState<Valores>({});
  const [propios, setPropios] = useState<Record<string, Valores>>({});
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [ajustando, setAjustando] = useState<Set<string>>(new Set());
  const [apartado, setApartado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoUnidad[] | null>(null);
  const [guardando, startGuardar] = useTransition();

  const apartados = useMemo(() => Array.from(new Set(unidades.map((u) => u.apartado))).sort(), [unidades]);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return unidades.filter((u) => (!apartado || u.apartado === apartado) && (!q || u.nombre.toLowerCase().includes(q)));
  }, [unidades, apartado, busqueda]);
  const seleccionadas = unidades.filter((u) => elegidas.has(u.id));
  const todasVisiblesElegidas = visibles.length > 0 && visibles.every((u) => elegidas.has(u.id));

  const valorDe = (id: string, campo: string) => (propios[id]?.[campo] ?? "").trim() || (comunes[campo] ?? "").trim();
  const faltantesDe = (id: string) => defs.filter((d) => d.requerido && !valorDe(id, d.campo)).map((d) => d.etiqueta);

  function tocar<T>(fn: () => T): T {
    setRevisando(false);
    setResultados(null);
    return fn();
  }

  function alternar(id: string) {
    tocar(() =>
      setElegidas((prev) => {
        const n = new Set(prev);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      })
    );
  }

  function alternarVisibles() {
    tocar(() =>
      setElegidas((prev) => {
        const n = new Set(prev);
        if (todasVisiblesElegidas) visibles.forEach((u) => n.delete(u.id));
        else visibles.forEach((u) => n.add(u.id));
        return n;
      })
    );
  }

  function alternarAjuste(id: string) {
    setAjustando((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function revisar() {
    setError(null);
    setResultados(null);
    if (seleccionadas.length === 0) return setError("Elige al menos una unidad.");
    for (const u of seleccionadas) {
      const faltan = faltantesDe(u.id);
      if (faltan.length > 0) return setError(`${u.nombre}: falta ${faltan.join(", ")}. Llénalo arriba para todas o en «Ajustar» para esa unidad.`);
    }
    setRevisando(true);
  }

  function guardar() {
    setError(null);
    startGuardar(async () => {
      const r = await registrarEnLote(citySlug, {
        tipo,
        comunes,
        filas: seleccionadas.map((u) => ({ vehicleId: u.id, propios: propios[u.id] ?? {} })),
        password: contrasena,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      const res = r.resultados ?? [];
      setResultados(res);
      setContrasena("");
      setRevisando(false);
      // Las que se guardaron salen de la selección; las que fallaron se quedan
      // para corregir y reintentar sin duplicar las buenas.
      const buenas = new Set(res.filter((x) => x.ok).map((x) => x.vehicleId));
      setElegidas((prev) => new Set(Array.from(prev).filter((id) => !buenas.has(id))));
    });
  }

  const guardadas = resultados?.filter((r) => r.ok) ?? [];
  const falladas = resultados?.filter((r) => !r.ok) ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-3 text-sm font-medium text-ink">Datos que se repiten en todas las unidades elegidas</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {defs.map((def) => (
            <label key={def.campo} className="text-sm text-ink">
              {def.etiqueta}
              {def.requerido && <span className="text-red-700"> *</span>}
              <div className="mt-1">
                <Control def={def} valor={comunes[def.campo] ?? ""} onCambio={(v) => tocar(() => setComunes((p) => ({ ...p, [def.campo]: v })))} />
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-ink">
          Apartado
          <select value={apartado} onChange={(e) => setApartado(e.target.value)} className={`${entrada} mt-1 block`}>
            <option value="">Todos</option>
            {apartados.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-ink">
          Buscar unidad
          <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${entrada} mt-1 block`} />
        </label>
        <button type="button" onClick={alternarVisibles} className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5">
          {todasVisiblesElegidas ? "Quitar las que se ven" : "Elegir todas las que se ven"}
        </button>
        <p className="text-sm text-ink">
          {seleccionadas.length} elegida(s) de {unidades.length}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-ink">
            <tr>
              <th className="w-10 px-3 py-2"></th>
              <th className="px-3 py-2">Unidad</th>
              <th className="px-3 py-2">Apartado</th>
              <th className="px-3 py-2">Distinto en esta unidad</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((u) => {
              const marcada = elegidas.has(u.id);
              const abierta = marcada && ajustando.has(u.id);
              return (
                <tr key={u.id} className={`border-t border-gray-100 align-top ${marcada ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={marcada} onChange={() => alternar(u.id)} aria-label={`Elegir ${u.nombre}`} />
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {u.nombre}
                    <span className="block text-xs font-normal text-ink">{u.ciudad}</span>
                  </td>
                  <td className="px-3 py-2">{u.apartado}</td>
                  <td className="px-3 py-2">
                    {marcada && (
                      <>
                        <button type="button" onClick={() => alternarAjuste(u.id)} className="text-xs font-medium text-primary underline">
                          {abierta ? "Cerrar" : Object.values(propios[u.id] ?? {}).some((v) => v) ? "Ajustar (tiene cambios)" : "Ajustar"}
                        </button>
                        {abierta && (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {defs.map((def) => (
                              <label key={def.campo} className="text-xs text-ink">
                                {def.etiqueta}
                                <Control
                                  def={def}
                                  valor={propios[u.id]?.[def.campo] ?? ""}
                                  marcador={def.control === "opciones" ? "Igual que arriba" : comunes[def.campo] ? `Igual: ${def.control === "fecha" ? dmy(comunes[def.campo]) : comunes[def.campo]}` : "Igual que arriba"}
                                  etiquetaAria={`${def.etiqueta} de ${u.nombre}`}
                                  onCambio={(v) => tocar(() => setPropios((p) => ({ ...p, [u.id]: { ...p[u.id], [def.campo]: v } })))}
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-ink">
                  No hay unidades con ese filtro a las que se les pueda registrar esto en lote.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {error && <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      {guardadas.length > 0 && (
        <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">
          Se registró {tipoLoteLabel[tipo]} en {guardadas.length} unidad(es): {guardadas.map((r) => r.nombre).join(", ")}. Quedó en la bitácora de cada una y en la
          bitácora de actividad a tu nombre.
        </p>
      )}
      {falladas.length > 0 && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-medium">No se pudo registrar en {falladas.length} unidad(es) (siguen elegidas para que las corrijas):</p>
          <ul className="list-disc pl-5">
            {falladas.map((r) => (
              <li key={r.vehicleId}>
                {r.nombre}: {r.mensaje}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!revisando ? (
        <button type="button" onClick={revisar} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark">
          Revisar antes de guardar
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">
            Se va a registrar «{tipoLoteLabel[tipo]}» en {seleccionadas.length} unidad(es). Esto es lo que se guardará en cada una:
          </p>
          <div className="max-h-64 overflow-auto rounded-md bg-white p-2 text-ink">
            <table className="w-full text-xs">
              <thead className="text-left text-gray-500">
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
                {seleccionadas.map((u) => (
                  <tr key={u.id} className="border-t border-gray-100">
                    <td className="py-1 pr-3 font-medium">{u.nombre}</td>
                    {defs.map((d) => {
                      const v = valorDe(u.id, d.campo);
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
          <p>Cada una queda como un registro nuevo en su bitácora (lo anterior se conserva como historial).</p>
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
              {guardando ? "Guardando..." : "Estoy de acuerdo, guardar"}
            </button>
            <button type="button" onClick={() => setRevisando(false)} disabled={guardando} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-ink">
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
