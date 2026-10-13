"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  TIPOS_DOCUMENTO_PRUEBA,
  tipoDocumentoPruebaLabel,
  type DocumentoPrueba,
  type TipoDocumentoPrueba,
} from "@/lib/test-document-tipos";
import { formatDate } from "@/lib/dates";

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const inputClass =
  "rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-ink focus:border-primary focus:outline-none";

// Listado de todos los documentos subidos en los registros de las unidades
// de una ciudad, con filtros y casillas para elegir cuáles bajar en un ZIP
// (ver app/api/ciudades/[citySlug]/documentos-zip). Los filtros solo cambian
// lo que se ve: lo ya marcado se conserva aunque quede oculto, y el contador
// siempre dice cuántos van en la descarga.
export function TestDocumentsPicker({
  documentos,
  zipAction,
  mostrarCiudad,
}: {
  documentos: DocumentoPrueba[];
  zipAction: string;
  // Administración (ciudad agregada): los documentos vienen de varias ciudades.
  mostrarCiudad: boolean;
}) {
  const tiposPresentes = useMemo(
    () => TIPOS_DOCUMENTO_PRUEBA.filter((t) => documentos.some((d) => d.tipo === t.id)),
    [documentos]
  );
  const apartados = useMemo(() => [...new Set(documentos.map((d) => d.apartado))].sort(), [documentos]);
  const ciudades = useMemo(() => [...new Set(documentos.map((d) => d.cityName))].sort(), [documentos]);

  const [tipos, setTipos] = useState<Set<TipoDocumentoPrueba>>(() => new Set(tiposPresentes.map((t) => t.id)));
  const [apartado, setApartado] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [incluirBajas, setIncluirBajas] = useState(false);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return documentos.filter(
      (d) =>
        tipos.has(d.tipo) &&
        (!apartado || d.apartado === apartado) &&
        (!ciudad || d.cityName === ciudad) &&
        (incluirBajas || d.activo) &&
        (!q || d.numeroEconomico.toLowerCase().includes(q) || d.fileName.toLowerCase().includes(q))
    );
  }, [documentos, tipos, apartado, ciudad, busqueda, incluirBajas]);

  const seleccionados = useMemo(() => documentos.filter((d) => seleccion.has(d.id)), [documentos, seleccion]);
  const tamanoSeleccion = seleccionados.reduce((total, d) => total + d.size, 0);
  const todosVisiblesMarcados = visibles.length > 0 && visibles.every((d) => seleccion.has(d.id));

  function alternarTipo(tipo: TipoDocumentoPrueba) {
    setTipos((prev) => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo);
      else next.add(tipo);
      return next;
    });
  }

  function alternarDocumento(id: string) {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alternarVisibles() {
    setSeleccion((prev) => {
      const next = new Set(prev);
      if (todosVisiblesMarcados) visibles.forEach((d) => next.delete(d.id));
      else visibles.forEach((d) => next.add(d.id));
      return next;
    });
  }

  if (documentos.length === 0) {
    return (
      <p className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-ink">
        Todavía no hay documentos subidos en los registros de las unidades.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Tipo de documento</p>
        <div className="flex flex-wrap gap-2">
          {tiposPresentes.map((t) => {
            const activo = tipos.has(t.id);
            const cuantos = documentos.filter((d) => d.tipo === t.id).length;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => alternarTipo(t.id)}
                aria-pressed={activo}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  activo
                    ? "border-primary bg-primary text-white"
                    : "border-gray-300 bg-white text-ink hover:bg-gray-50"
                }`}
              >
                {t.label} ({cuantos})
              </button>
            );
          })}
          <button
            type="button"
            onClick={() =>
              setTipos(tipos.size === tiposPresentes.length ? new Set() : new Set(tiposPresentes.map((t) => t.id)))
            }
            className="px-2 py-1 text-xs text-primary hover:underline"
          >
            {tipos.size === tiposPresentes.length ? "Ninguno" : "Todos"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-ink">
            Buscar unidad o archivo
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="p. ej. PH 71"
              className={`${inputClass} w-48`}
            />
          </label>
          {mostrarCiudad && ciudades.length > 1 && (
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Ciudad
              <select value={ciudad} onChange={(e) => setCiudad(e.target.value)} className={inputClass}>
                <option value="">Todas</option>
                {ciudades.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}
          {apartados.length > 1 && (
            <label className="flex flex-col gap-1 text-xs font-medium text-ink">
              Apartado
              <select value={apartado} onChange={(e) => setApartado(e.target.value)} className={inputClass}>
                <option value="">Todos</option>
                {apartados.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex items-center gap-2 pb-1.5 text-xs font-medium text-ink">
            <input
              type="checkbox"
              checked={incluirBajas}
              onChange={(e) => setIncluirBajas(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Incluir unidades dadas de baja
          </label>
        </div>
      </div>

      <form
        action={zipAction}
        method="post"
        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-white p-3 shadow-sm"
      >
        {[...seleccion].map((id) => (
          <input key={id} type="hidden" name="ids" value={id} />
        ))}
        <p className="text-sm text-ink">
          <span className="font-semibold">{seleccionados.length}</span> documento(s) seleccionados
          {seleccionados.length > 0 && <> · {formatSize(tamanoSeleccion)}</>}
          {seleccionados.length > 0 && (
            <button type="button" onClick={() => setSeleccion(new Set())} className="ml-3 text-xs text-primary hover:underline">
              Quitar selección
            </button>
          )}
        </p>
        <button
          type="submit"
          disabled={seleccionados.length === 0}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0-4-4m4 4 4-4" />
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Descargar seleccionados (ZIP)
        </button>
      </form>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={todosVisiblesMarcados}
                  onChange={alternarVisibles}
                  aria-label="Seleccionar todos los visibles"
                  className="h-4 w-4 rounded border-gray-300"
                />
              </th>
              <th className="px-3 py-2">Unidad</th>
              {mostrarCiudad && <th className="px-3 py-2">Ciudad</th>}
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Archivo</th>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2 text-right">Tamaño</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibles.map((d) => {
              const esImagen = d.mimeType.startsWith("image/");
              const href = esImagen ? `/api/documents/${d.id}` : `/documentos/${d.id}`;
              return (
                <tr key={d.id} className={seleccion.has(d.id) ? "bg-primary/5" : undefined}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={seleccion.has(d.id)}
                      onChange={() => alternarDocumento(d.id)}
                      aria-label={`Seleccionar ${d.fileName}`}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Link href={`/ciudades/${d.citySlug}/vehiculo/${d.vehicleId}`} className="font-medium text-primary hover:underline">
                      {d.numeroEconomico}
                    </Link>
                    <span className="block text-xs text-gray-500">
                      {d.apartado}
                      {!d.activo && " · dada de baja"}
                    </span>
                  </td>
                  {mostrarCiudad && <td className="whitespace-nowrap px-3 py-2 text-ink">{d.cityName}</td>}
                  <td className="whitespace-nowrap px-3 py-2 text-ink">{tipoDocumentoPruebaLabel[d.tipo]}</td>
                  <td className="px-3 py-2">
                    <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-ink hover:text-primary hover:underline">
                      {d.fileName}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-ink">
                    {d.fechaEvento ? formatDate(d.fechaEvento) : <span className="text-gray-500">Subido {formatDate(d.subidoEl)}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-ink">{formatSize(d.size)}</td>
                </tr>
              );
            })}
            {visibles.length === 0 && (
              <tr>
                <td colSpan={mostrarCiudad ? 7 : 6} className="px-3 py-6 text-center text-sm text-gray-500">
                  Ningún documento coincide con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        Mostrando {visibles.length} de {documentos.length} documentos. El ZIP se arma con carpetas por unidad y tipo de
        documento.
      </p>
    </div>
  );
}
