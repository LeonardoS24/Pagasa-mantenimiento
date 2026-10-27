import Link from "next/link";
import { getSession } from "@/lib/auth";
import { EVENTOS_ACCESO, EVENTOS_DE_RIESGO, type EventoAcceso } from "@/lib/registro-acceso";
import { POR_PAGINA, getRegistrosAcceso, getResumenAccesos, getUsuariosDeLaBitacora, leerFiltros } from "@/lib/bitacora-acceso";
import { cerrarSesionAjena, desbloquearCuenta } from "@/actions/accesos-actions";

// Quién entró, cuándo, desde dónde, y los intentos que fallaron. La
// protección de la ruta la da app/(protected)/admin/layout.tsx.

function fechaHora(fecha: Date): string {
  return fecha.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

const ESTILO_EVENTO: Partial<Record<EventoAcceso, string>> = {
  INICIO_SESION: "bg-green-100 text-green-800",
  CIERRE_SESION: "bg-gray-100 text-gray-700",
  CIERRE_INACTIVIDAD: "bg-gray-100 text-gray-700",
  SESION_EXPIRADA: "bg-gray-100 text-gray-700",
};

export default async function AccesosPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const session = await getSession();
  const filtros = leerFiltros(searchParams);
  const pagina = Math.max(1, Number(searchParams.pagina) || 1);
  const [{ registros, total }, resumen, usuarios] = await Promise.all([
    getRegistrosAcceso(filtros, pagina),
    getResumenAccesos(),
    getUsuariosDeLaBitacora(),
  ]);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const query = (extra: Record<string, string | number>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...filtros, ...extra })) if (v !== undefined && v !== "") p.set(k, String(v));
    return `?${p.toString()}`;
  };
  const excel = `/api/admin/accesos${query({})}`;
  const campo = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";

  return (
    <div className="space-y-6">
      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Inicios de sesión hoy", resumen.iniciosHoy, "text-primary"],
          ["Intentos fallidos (24 h)", resumen.fallidos24h, resumen.fallidos24h > 0 ? "text-red-700" : "text-primary"],
          ["Cuentas bloqueadas ahora", resumen.bloqueadas.length, resumen.bloqueadas.length > 0 ? "text-red-700" : "text-primary"],
          ["Sesiones abiertas", resumen.sesiones.length, "text-primary"],
        ].map(([t, n, c]) => (
          <div key={t as string} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{t}</p>
            <p className={`text-2xl font-semibold ${c}`}>{n}</p>
          </div>
        ))}
      </div>

      {resumen.bloqueadas.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-red-800">Cuentas bloqueadas por intentos fallidos</h2>
          <ul className="space-y-1 text-sm">
            {resumen.bloqueadas.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3">
                <span className="font-medium">{u.username}</span>
                <span className="text-red-700">hasta {u.bloqueadoHasta && fechaHora(u.bloqueadoHasta)}</span>
                <form action={desbloquearCuenta.bind(null, u.id)}>
                  <button className="rounded border border-red-400 px-2 py-0.5 text-xs text-red-800 hover:bg-red-100">Desbloquear</button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sesiones abiertas */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-1 text-sm font-semibold uppercase text-primary-bright">Sesiones abiertas</h2>
        <p className="mb-3 text-xs text-gray-500">
          Las que siguen vigentes (hasta 12 h desde que se inició; se cierran antes con 20 min sin actividad o al cerrar el
          navegador). Cerrar una saca a esa persona en su siguiente clic.
        </p>
        {resumen.sesiones.length === 0 ? (
          <p className="text-sm text-ink">No hay sesiones abiertas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500">
                <tr>
                  <th className="py-1 pr-3">Usuario</th>
                  <th className="py-1 pr-3">Inició</th>
                  <th className="py-1 pr-3">Equipo (IP)</th>
                  <th className="py-1 pr-3">Navegador</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resumen.sesiones.map((s) => (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="py-1.5 pr-3 font-medium text-ink">
                      {s.user.username}
                      {s.id === session.sesionId && <span className="ml-1 text-xs text-gray-500">(esta)</span>}
                    </td>
                    <td className="py-1.5 pr-3">{fechaHora(s.creadaEl)}</td>
                    <td className="py-1.5 pr-3 font-mono text-xs">{s.ip ?? "—"}</td>
                    <td className="py-1.5 pr-3 text-xs">{s.navegador ?? "—"}</td>
                    <td className="py-1.5 text-right">
                      {s.id !== session.sesionId && (
                        <form action={cerrarSesionAjena.bind(null, s.id)}>
                          <button className="rounded border border-gray-300 px-2 py-0.5 text-xs hover:bg-gray-50">Cerrar sesión</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bitácora */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">Bitácora de acceso</h2>
        <form method="GET" className="mb-4 flex flex-wrap items-end gap-3 text-sm">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Usuario</span>
            <select name="usuario" defaultValue={filtros.usuario ?? ""} className={campo}>
              <option value="">Todos</option>
              {usuarios.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Evento</span>
            <select name="evento" defaultValue={filtros.evento ?? ""} className={campo}>
              <option value="">Todos</option>
              <option value="riesgo">Solo intentos fallidos y bloqueos</option>
              {Object.entries(EVENTOS_ACCESO).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Desde</span>
            <input type="date" name="desde" defaultValue={filtros.desde ?? ""} className={campo} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">Hasta</span>
            <input type="date" name="hasta" defaultValue={filtros.hasta ?? ""} className={campo} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-gray-500">IP</span>
            <input type="text" name="ip" defaultValue={filtros.ip ?? ""} placeholder="192.168..." className={`${campo} w-32`} />
          </label>
          <button type="submit" className="rounded-md bg-primary px-4 py-1.5 text-white hover:bg-primary-dark">
            Filtrar
          </button>
          <Link href="/admin/accesos" className="py-1.5 text-primary hover:underline">
            Quitar filtros
          </Link>
          <a href={excel} className="ml-auto rounded-md border border-primary px-3 py-1.5 text-primary hover:bg-primary/5">
            Descargar Excel
          </a>
        </form>

        <p className="mb-2 text-xs text-gray-500">{total.toLocaleString("es-MX")} registro(s)</p>
        {registros.length === 0 ? (
          <p className="rounded border border-dashed border-gray-300 p-6 text-center text-sm text-ink">No hay registros con esos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-gray-500">
                <tr>
                  <th className="py-1 pr-3">Fecha</th>
                  <th className="py-1 pr-3">Evento</th>
                  <th className="py-1 pr-3">Usuario</th>
                  <th className="py-1 pr-3">Detalle</th>
                  <th className="py-1 pr-3">Equipo (IP)</th>
                  <th className="py-1">Navegador</th>
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => {
                  const evento = r.evento as EventoAcceso;
                  const riesgo = EVENTOS_DE_RIESGO.includes(evento);
                  return (
                    <tr key={r.id} className={`border-t border-gray-100 ${riesgo ? "bg-red-50/60" : ""}`}>
                      <td className="whitespace-nowrap py-1.5 pr-3">{fechaHora(r.createdAt)}</td>
                      <td className="py-1.5 pr-3">
                        <span
                          className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                            riesgo ? "bg-red-100 text-red-800" : ESTILO_EVENTO[evento] ?? "bg-blue-50 text-primary"
                          }`}
                        >
                          {EVENTOS_ACCESO[evento] ?? r.evento}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 font-medium text-ink">{r.username}</td>
                      <td className="py-1.5 pr-3 text-xs text-gray-600">
                        {[r.detalle, r.actorUsername ? `por ${r.actorUsername}` : null].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="py-1.5 pr-3 font-mono text-xs">
                        {r.ip ? (
                          <Link href={`/admin/accesos${query({ ip: r.ip, pagina: 1 })}`} className="hover:underline">
                            {r.ip}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-1.5 text-xs">{r.navegador ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {paginas > 1 && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            {pagina > 1 && <Link href={`/admin/accesos${query({ pagina: pagina - 1 })}`} className="text-primary hover:underline">← Anteriores</Link>}
            <span className="text-gray-500">
              Página {pagina} de {paginas}
            </span>
            {pagina < paginas && <Link href={`/admin/accesos${query({ pagina: pagina + 1 })}`} className="text-primary hover:underline">Siguientes →</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
