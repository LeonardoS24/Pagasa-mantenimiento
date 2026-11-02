"use client";

import { useState, useTransition } from "react";
import { aprobarCambiosAlmacen, descartarCambiosAlmacen, guardarEnlaceHoja, leerHojaAhora } from "@/actions/almacen-actions";
import type { DifArticulo, DifMovimiento } from "@/lib/almacen";

export type DatosPendiente = {
  leidaEl: string;
  avisos: string[];
  articulos: DifArticulo[];
  movimientos: DifMovimiento[];
  movimientosAusentes: number;
  unidadesSinVincular: string[];
};

const TIPO_ARTICULO: Record<DifArticulo["tipo"], { texto: string; color: string }> = {
  nuevo: { texto: "Artículo nuevo", color: "text-green-700" },
  cambio: { texto: "Cambia", color: "text-primary" },
  reactivar: { texto: "Vuelve a aparecer", color: "text-green-700" },
  ausente: { texto: "Ya no aparece en la hoja (se marca inactivo, no se borra)", color: "text-amber-700" },
};

function dmy(iso: string | null, texto: string | null): string {
  if (!iso) return texto ?? "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export function AlmacenPanel({
  citySlug,
  puede,
  urlHoja,
  ultimaLectura,
  ultimoError,
  pendiente,
}: {
  citySlug: string;
  puede: boolean;
  urlHoja: string;
  ultimaLectura: string | null;
  ultimoError: string | null;
  pendiente: DatosPendiente | null;
}) {
  const [url, setUrl] = useState(urlHoja);
  const [contrasena, setContrasena] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(ultimoError);
  const [ocupado, empezar] = useTransition();

  function correr(fn: () => Promise<{ ok: boolean; error?: string; mensaje?: string }>, alTerminar?: () => void) {
    setMensaje(null);
    setError(null);
    empezar(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error ?? "No se pudo completar.");
      else {
        setMensaje(r.mensaje ?? null);
        alTerminar?.();
      }
    });
  }

  const entrada = "rounded-md border border-gray-300 px-3 py-2 text-sm";
  const boton = "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-dark disabled:opacity-60";

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <p className="text-sm font-medium text-ink">Hoja de Google del inventario</p>
        {puede ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
              aria-label="Enlace de la hoja de Google"
              className={`${entrada} min-w-[22rem] flex-1`}
            />
            <button type="button" disabled={ocupado} onClick={() => correr(() => guardarEnlaceHoja(citySlug, url))} className={boton}>
              Guardar enlace
            </button>
            <button
              type="button"
              disabled={ocupado || !urlHoja}
              onClick={() => correr(() => leerHojaAhora(citySlug))}
              className="rounded-lg border border-primary px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-60"
            >
              {ocupado ? "Leyendo..." : "Leer la hoja ahora"}
            </button>
          </div>
        ) : (
          <p className="text-sm text-ink">{urlHoja ? "La hoja ya está conectada." : "Todavía no se conecta la hoja."}</p>
        )}
        <p className="text-xs text-ink">
          La hoja tiene que estar compartida como «Cualquier persona con el enlace → Lector» y traer las pestañas <b>Inventario</b> y <b>Movimientos</b>. El
          sistema la lee solo cada 30 minutos; <b>no guarda nada hasta que alguien apruebe los cambios con su contraseña</b>.
          {ultimaLectura && <> Última lectura: {new Date(ultimaLectura).toLocaleString("es-MX")}.</>}
        </p>
        {error && <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
        {mensaje && <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-800">{mensaje}</p>}
      </div>

      {pendiente && (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">
            La hoja cambió ({new Date(pendiente.leidaEl).toLocaleString("es-MX")}). Esto es lo que se va a actualizar en el sistema:
          </p>

          {pendiente.avisos.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-orange-900">
              {pendiente.avisos.slice(0, 20).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}

          {pendiente.articulos.length > 0 && (
            <div className="rounded-md bg-white p-3">
              <p className="mb-2 text-sm font-medium text-ink">Artículos ({pendiente.articulos.length})</p>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-xs">
                  <tbody>
                    {pendiente.articulos.map((d) => (
                      <tr key={d.clave} className="border-t border-gray-100 align-top">
                        <td className="py-1 pr-3 font-medium text-ink">{d.articulo}</td>
                        <td className={`py-1 pr-3 ${TIPO_ARTICULO[d.tipo].color}`}>{TIPO_ARTICULO[d.tipo].texto}</td>
                        <td className="py-1 text-ink">
                          {d.cambios.map((c) => (
                            <div key={c.campo}>
                              {c.campo}: <span className="text-gray-500">{c.antes}</span> → <b>{c.despues}</b>
                            </div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pendiente.movimientos.length > 0 && (
            <div className="rounded-md bg-white p-3">
              <p className="mb-2 text-sm font-medium text-ink">Movimientos ({pendiente.movimientos.length})</p>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="py-1 pr-3">Fecha</th>
                      <th className="py-1 pr-3">Movimiento</th>
                      <th className="py-1 pr-3">Artículo</th>
                      <th className="py-1 pr-3">Cant.</th>
                      <th className="py-1 pr-3">Trabajador</th>
                      <th className="py-1">Unidad / Estación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendiente.movimientos.map((d, i) => (
                      <tr key={i} className="border-t border-gray-100 align-top">
                        <td className="py-1 pr-3">{dmy(d.movimiento.fecha, d.movimiento.fechaTexto)}</td>
                        <td className="py-1 pr-3">{d.movimiento.movimiento ?? "—"}</td>
                        <td className="py-1 pr-3 font-medium text-ink">{d.movimiento.articulo}</td>
                        <td className="py-1 pr-3">{d.movimiento.cantidad ?? "—"}</td>
                        <td className="py-1 pr-3">{d.movimiento.trabajador ?? "—"}</td>
                        <td className="py-1">
                          {d.tipo === "cambio" ? (
                            d.cambios.map((c) => (
                              <div key={c.campo}>
                                {c.campo}: <span className="text-gray-500">{c.antes}</span> → <b>{c.despues}</b>
                              </div>
                            ))
                          ) : (
                            (d.movimiento.unidad ?? "—")
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {pendiente.unidadesSinVincular.length > 0 && (
            <p className="text-sm text-orange-900">
              Estas unidades de la hoja no coinciden con ninguna del sistema (se guardan como texto, sin vincular): {pendiente.unidadesSinVincular.join("; ")}.
              Elige la unidad de la lista desplegable para que se vincule.
            </p>
          )}
          {pendiente.movimientosAusentes > 0 && (
            <p className="text-sm text-amber-900">
              {pendiente.movimientosAusentes} movimiento(s) guardados ya no aparecen en la hoja. Se conservan en el sistema: los movimientos nunca se borran.
            </p>
          )}

          {puede ? (
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
              <button
                type="button"
                disabled={ocupado}
                onClick={() =>
                  correr(
                    () => aprobarCambiosAlmacen(citySlug, contrasena),
                    () => setContrasena("")
                  )
                }
                className={boton}
              >
                {ocupado ? "Guardando..." : "Estoy de acuerdo, guardar"}
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => correr(() => descartarCambiosAlmacen(citySlug))}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-ink disabled:opacity-60"
              >
                Descartar
              </button>
            </div>
          ) : (
            <p className="text-sm text-amber-900">Un administrador (o un usuario con acceso ampliado) tiene que aprobar estos cambios.</p>
          )}
        </div>
      )}
    </div>
  );
}
