"use client";

import { useMemo, useState, useTransition, type ClipboardEvent, type KeyboardEvent } from "react";
import { registrarEnLote, revisarNumerosEnLote, type NumeroYaUsado, type ResultadoUnidad } from "@/actions/registro-lote-actions";
import { CAMPOS_POR_TIPO, tipoLoteLabel, type DefCampo, type TipoLote } from "@/lib/lote-documentos";
import { camposObligatoriosEnLote, camposPorUnidad, claveDeNumero, numerarEnSerie, numerosRepetidos } from "@/lib/registro-lote";

export type UnidadLote = { id: string; nombre: string; apartado: string; ciudad: string };

type Valores = Record<string, string>;

const entrada = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";

function dmy(valor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : valor;
}

type Extras = {
  "data-campo"?: string;
  onPaste?: (e: ClipboardEvent<HTMLElement>) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
};

function Control({
  def,
  valor,
  onCambio,
  marcador,
  etiquetaAria,
  extras,
  invalido,
}: {
  def: DefCampo;
  valor: string;
  onCambio: (v: string) => void;
  marcador?: string;
  etiquetaAria?: string;
  extras?: Extras;
  invalido?: boolean;
}) {
  const comunes = {
    value: valor,
    "aria-label": etiquetaAria ?? def.etiqueta,
    "aria-invalid": invalido || undefined,
    className: `${entrada} block w-full ${invalido ? "border-red-500 bg-red-50" : ""}`,
    ...extras,
  };
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
  // Lo que es distinto en cada unidad (el número del ultrasonido, el
  // kilometraje...) va en una columna por unidad; lo demás se llena una vez.
  const porUnidad = camposPorUnidad(tipo);
  const defsPorUnidad = defs.filter((d) => porUnidad.includes(d.campo));
  const defsComunes = defs.filter((d) => !porUnidad.includes(d.campo));
  const obligatorios = useMemo(() => new Set<string>(camposObligatoriosEnLote(tipo)), [tipo]);
  const llevaNumero = porUnidad.includes("numero");
  const esObligatorio = (d: DefCampo) => obligatorios.has(d.campo);

  const [comunes, setComunes] = useState<Valores>({});
  const [propios, setPropios] = useState<Record<string, Valores>>({});
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [ajustando, setAjustando] = useState<Set<string>>(new Set());
  const [apartado, setApartado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [revisando, setRevisando] = useState(false);
  const [avisos, setAvisos] = useState<NumeroYaUsado[]>([]);
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<ResultadoUnidad[] | null>(null);
  const [prefijo, setPrefijo] = useState("");
  const [desde, setDesde] = useState("1");
  const [guardando, startGuardar] = useTransition();
  const [comprobando, startComprobar] = useTransition();

  const apartados = useMemo(() => Array.from(new Set(unidades.map((u) => u.apartado))).sort(), [unidades]);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return unidades.filter((u) => (!apartado || u.apartado === apartado) && (!q || u.nombre.toLowerCase().includes(q)));
  }, [unidades, apartado, busqueda]);
  const seleccionadas = unidades.filter((u) => elegidas.has(u.id));
  const todasVisiblesElegidas = visibles.length > 0 && visibles.every((u) => elegidas.has(u.id));

  const valorDe = (id: string, campo: string) => (propios[id]?.[campo] ?? "").trim() || (comunes[campo] ?? "").trim();
  const faltantesDe = (id: string) => defs.filter((d) => esObligatorio(d) && !valorDe(id, d.campo)).map((d) => d.etiqueta);

  // Los números que se repiten entre las unidades elegidas, para marcarlos en
  // rojo al momento y no dejar guardar así.
  const repetidos = useMemo(() => {
    if (!llevaNumero) return new Map<string, string[]>();
    const grupos = numerosRepetidos(seleccionadas.map((u) => ({ unidad: u.nombre, numero: (propios[u.id]?.numero ?? "").trim() })));
    const m = new Map<string, string[]>();
    for (const g of grupos) m.set(claveDeNumero(g.numero), g.unidades);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llevaNumero, propios, elegidas, unidades]);
  const estaRepetido = (id: string) => llevaNumero && repetidos.has(claveDeNumero((propios[id]?.numero ?? "").trim()));

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

  function ponerPropio(id: string, campo: string, valor: string) {
    tocar(() => setPropios((p) => ({ ...p, [id]: { ...p[id], [campo]: valor } })));
  }

  // Enter en una celda de la columna pasa a la misma columna de la siguiente
  // unidad elegida, como en una hoja de cálculo.
  function alTeclear(e: KeyboardEvent<HTMLElement>, campo: string) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    const celdas = Array.from(document.querySelectorAll<HTMLElement>(`[data-campo="${campo}"]`));
    const i = celdas.indexOf(e.currentTarget);
    celdas[i + 1]?.focus();
  }

  // Pegar varias líneas (una columna copiada de Excel) reparte cada línea a
  // la unidad elegida de ese renglón y de los siguientes.
  function alPegar(e: ClipboardEvent<HTMLElement>, id: string, campo: string) {
    const texto = e.clipboardData.getData("text");
    if (!/[\r\n]/.test(texto.trim())) return;
    e.preventDefault();
    const lineas = texto.replace(/\r/g, "").split("\n").map((l) => l.split("\t")[0].trim());
    while (lineas.length > 0 && lineas[lineas.length - 1] === "") lineas.pop();
    const orden = visibles.filter((u) => elegidas.has(u.id)).map((u) => u.id);
    const inicio = orden.indexOf(id);
    if (inicio < 0) return;
    tocar(() =>
      setPropios((p) => {
        const n = { ...p };
        lineas.forEach((v, i) => {
          const uid = orden[inicio + i];
          if (uid) n[uid] = { ...n[uid], [campo]: v };
        });
        return n;
      })
    );
  }

  function numerar() {
    const numeros = numerarEnSerie(prefijo.trim(), desde, seleccionadas.length);
    if (numeros.length === 0) return setError("Escribe desde qué número empezar (por ejemplo 1) y elige las unidades.");
    setError(null);
    tocar(() =>
      setPropios((p) => {
        const n = { ...p };
        seleccionadas.forEach((u, i) => (n[u.id] = { ...n[u.id], numero: numeros[i] }));
        return n;
      })
    );
  }

  function revisar() {
    setError(null);
    setResultados(null);
    if (seleccionadas.length === 0) return setError("Elige al menos una unidad.");
    for (const u of seleccionadas) {
      const faltan = faltantesDe(u.id);
      if (faltan.length > 0) {
        return setError(
          `${u.nombre}: falta ${faltan.join(", ")}. ${defsPorUnidad.length > 0 ? "Escríbelo en su renglón" : "Llénalo arriba para todas"} o en «Ajustar» para esa unidad.`
        );
      }
    }
    const rep = seleccionadas.find((u) => estaRepetido(u.id));
    if (rep) {
      const grupo = repetidos.get(claveDeNumero((propios[rep.id]?.numero ?? "").trim())) ?? [];
      return setError(`El número «${(propios[rep.id]?.numero ?? "").trim()}» está en ${grupo.join(", ")}. Cada unidad lleva el suyo.`);
    }
    startComprobar(async () => {
      let hallados: NumeroYaUsado[] = [];
      if (llevaNumero) {
        try {
          const r = await revisarNumerosEnLote(
            citySlug,
            tipo,
            seleccionadas.map((u) => ({ vehicleId: u.id, numero: valorDe(u.id, "numero") }))
          );
          if (r.error) return setError(r.error);
          hallados = r.avisos;
        } catch {
          // El aviso de «ya existe» es ayuda, no requisito: si no se pudo
          // comprobar, se sigue (el servidor vuelve a validar al guardar).
        }
      }
      setAvisos(hallados);
      setRevisando(true);
    });
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
      // Lo propio de las que ya se guardaron (su número, su kilometraje) se
      // limpia: la siguiente tanda empieza en blanco.
      setPropios((p) => Object.fromEntries(Object.entries(p).filter(([id]) => !buenas.has(id))));
    });
  }

  const guardadas = resultados?.filter((r) => r.ok) ?? [];
  const falladas = resultados?.filter((r) => !r.ok) ?? [];
  const columnas = 4 + defsPorUnidad.length;

  return (
    <div className="space-y-4">
      {defsComunes.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="mb-1 text-sm font-medium text-ink">Datos que se repiten en todas las unidades elegidas</p>
          {defsPorUnidad.length > 0 && (
            <p className="mb-3 text-xs text-ink">
              {defsPorUnidad.map((d) => d.etiqueta).join(", ")} no va aquí: es distinto en cada unidad y se escribe en el renglón de cada una (abajo).
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {defsComunes.map((def) => (
              <label key={def.campo} className="text-sm text-ink">
                {def.etiqueta}
                {esObligatorio(def) && <span className="text-red-700"> *</span>}
                <div className="mt-1">
                  <Control def={def} valor={comunes[def.campo] ?? ""} onCambio={(v) => tocar(() => setComunes((p) => ({ ...p, [def.campo]: v })))} />
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

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

      {llevaNumero && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-3">
          <p className="basis-full text-xs text-ink">
            Cada unidad lleva su propio número. Escríbelo en su renglón (Enter pasa a la siguiente), pega una columna copiada de Excel, o numera en serie las elegidas:
          </p>
          <label className="text-sm text-ink">
            Texto antes del número
            <input value={prefijo} onChange={(e) => setPrefijo(e.target.value)} placeholder="Ej. US-" className={`${entrada} mt-1 block w-32`} />
          </label>
          <label className="text-sm text-ink">
            Empezar en
            <input value={desde} onChange={(e) => setDesde(e.target.value)} inputMode="numeric" className={`${entrada} mt-1 block w-24`} />
          </label>
          <button
            type="button"
            onClick={numerar}
            disabled={seleccionadas.length === 0}
            className="rounded-md border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
          >
            Numerar las {seleccionadas.length} elegida(s)
          </button>
          <p className="basis-full text-xs text-ink">Numerar pisa lo que ya hayas escrito en la columna de número de las unidades elegidas.</p>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-ink">
            <tr>
              <th className="w-10 px-3 py-2"></th>
              <th className="px-3 py-2">Unidad</th>
              <th className="px-3 py-2">Apartado</th>
              {defsPorUnidad.map((d) => (
                <th key={d.campo} className="px-3 py-2">
                  {d.etiqueta}
                  {esObligatorio(d) && <span className="text-red-700"> *</span>}
                </th>
              ))}
              <th className="px-3 py-2">{defsPorUnidad.length > 0 ? "Otro dato distinto" : "Distinto en esta unidad"}</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((u) => {
              const marcada = elegidas.has(u.id);
              const abierta = marcada && ajustando.has(u.id);
              const defsAjuste = defsComunes;
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
                  {defsPorUnidad.map((def) => (
                    <td key={def.campo} className="min-w-[10rem] px-3 py-2">
                      {marcada && (
                        <>
                          <Control
                            def={def}
                            valor={propios[u.id]?.[def.campo] ?? ""}
                            marcador={esObligatorio(def) ? "Obligatorio" : undefined}
                            etiquetaAria={`${def.etiqueta} de ${u.nombre}`}
                            invalido={def.campo === "numero" && estaRepetido(u.id)}
                            extras={{
                              "data-campo": def.campo,
                              onKeyDown: (e) => alTeclear(e, def.campo),
                              onPaste: (e) => alPegar(e, u.id, def.campo),
                            }}
                            onCambio={(v) => ponerPropio(u.id, def.campo, v)}
                          />
                          {def.campo === "numero" && estaRepetido(u.id) && <span className="mt-1 block text-xs text-red-700">Repetido: ya está en otra unidad.</span>}
                        </>
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {marcada && defsAjuste.length > 0 && (
                      <>
                        <button type="button" onClick={() => alternarAjuste(u.id)} className="text-xs font-medium text-primary underline">
                          {abierta ? "Cerrar" : defsAjuste.some((d) => (propios[u.id]?.[d.campo] ?? "") !== "") ? "Ajustar (tiene cambios)" : "Ajustar"}
                        </button>
                        {abierta && (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {defsAjuste.map((def) => (
                              <label key={def.campo} className="text-xs text-ink">
                                {def.etiqueta}
                                <Control
                                  def={def}
                                  valor={propios[u.id]?.[def.campo] ?? ""}
                                  marcador={def.control === "opciones" ? "Igual que arriba" : comunes[def.campo] ? `Igual: ${def.control === "fecha" ? dmy(comunes[def.campo]) : comunes[def.campo]}` : "Igual que arriba"}
                                  etiquetaAria={`${def.etiqueta} de ${u.nombre}`}
                                  onCambio={(v) => ponerPropio(u.id, def.campo, v)}
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
                <td colSpan={columnas} className="px-3 py-6 text-center text-ink">
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
        <button
          type="button"
          onClick={revisar}
          disabled={comprobando}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60"
        >
          {comprobando ? "Revisando..." : "Revisar antes de guardar"}
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">
            Se va a registrar «{tipoLoteLabel[tipo]}» en {seleccionadas.length} unidad(es). Esto es lo que se guardará en cada una:
          </p>
          {avisos.length > 0 && (
            <div className="rounded-md border border-red-300 bg-red-50 p-2 text-red-800">
              <p className="font-medium">Ojo: estos números ya estaban registrados. Si es un error de captura, vuelve y corrígelo; si es a propósito, confirma.</p>
              <ul className="list-disc pl-5">
                {avisos.map((a) => (
                  <li key={a.vehicleId}>
                    {unidades.find((u) => u.id === a.vehicleId)?.nombre ?? "Unidad"}: «{a.numero}» ya está en {a.usadoEn}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
