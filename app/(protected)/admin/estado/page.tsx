import { arranquesRecientes, erroresRecientes, getEstadoServidor, type Nivel } from "@/lib/estado-servidor";

// Cómo está el servidor, de un vistazo: lo que debería estar en verde y, si
// algo falla, los últimos errores y reinicios (ver lib/estado-servidor.ts y
// scripts/registro-servidor.mjs). La protección la da el layout de /admin.
export const dynamic = "force-dynamic";

const COLOR: Record<Nivel, string> = {
  ok: "border-green-200 bg-green-50",
  aviso: "border-amber-200 bg-amber-50",
  mal: "border-red-300 bg-red-50",
};
const PUNTO: Record<Nivel, string> = { ok: "bg-green-500", aviso: "bg-amber-500", mal: "bg-red-600" };

export default async function EstadoPage() {
  const [{ puntos, version }, errores, arranques] = await Promise.all([getEstadoServidor(), erroresRecientes(), arranquesRecientes()]);
  const peor: Nivel = puntos.some((p) => p.nivel === "mal") ? "mal" : puntos.some((p) => p.nivel === "aviso") ? "aviso" : "ok";

  return (
    <div className="space-y-6">
      <div className={`rounded-lg border p-4 ${COLOR[peor]}`}>
        <p className="text-lg font-semibold text-ink">
          {peor === "ok" ? "Todo en orden" : peor === "aviso" ? "Funciona, con detalles por atender" : "Hay algo que atender"}
        </p>
        <p className="text-sm text-gray-600">
          Versión instalada: {version ? <span className="font-mono">{version.corto}</span> : "desconocida"}
          {version?.rama && ` (${version.rama})`}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {puntos.map((p) => (
          <div key={p.nombre} className={`rounded-lg border p-3 ${COLOR[p.nivel]}`}>
            <p className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-600">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${PUNTO[p.nivel]}`} />
              {p.nombre}
            </p>
            <p className="mt-1 font-medium text-ink">{p.valor}</p>
            {p.detalle && <p className="mt-0.5 break-words text-xs text-gray-600">{p.detalle}</p>}
          </div>
        ))}
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase text-primary-bright">Arranques y caídas</h2>
        {arranques.length === 0 ? (
          <p className="text-sm text-ink">Sin registro todavía (se llena al arrancar con servidor-iniciar.bat).</p>
        ) : (
          <ul className="space-y-0.5 font-mono text-xs text-ink">
            {arranques.map((l, i) => (
              <li key={i} className={/CAÍDA|REINICIO|NO ARRANCÓ/.test(l) ? "text-red-700" : ""}>
                {l}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase text-primary-bright">Errores recientes</h2>
        <p className="mb-2 text-xs text-gray-500">
          De hoy y ayer, el más nuevo arriba. El registro completo está en la carpeta logs\ del servidor (se guardan 30 días).
        </p>
        {errores.length === 0 ? (
          <p className="text-sm text-green-700">Ningún error registrado.</p>
        ) : (
          <ul className="max-h-96 space-y-1 overflow-auto font-mono text-xs text-red-800">
            {errores.map((l, i) => (
              <li key={i} className="break-words">
                {l}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
