import Link from "next/link";
import { MensajeDeAlerta } from "./MensajeDeAlerta";
import { formatDate } from "@/lib/dates";
import { verRecordLabel } from "@/lib/section-labels";
import type { AlertaPropiaCalculada } from "@/lib/alertas-servidor";

// Alertas que agregó el ADMIN (Alertas → Configurar alertas): un cuadro por
// alerta, con el mismo aspecto que las de fábrica.
function mensaje(a: AlertaPropiaCalculada): string {
  const quien = `"${a.numeroEconomico}"`;
  if (a.dias < 0) return `¡URGENTE! ${a.alertaNombre} de ${quien} VENCIÓ hace ${-a.dias} día(s).`;
  if (a.dias === 0) return `¡URGENTE! ${a.alertaNombre} de ${quien} vence HOY.`;
  if (a.level === "red") return `¡URGENTE! ${a.alertaNombre} de ${quien}: falta${a.dias === 1 ? "" : "n"} ${a.dias} día(s).`;
  return `Atención: ${a.alertaNombre} de ${quien}: falta${a.dias === 1 ? "" : "n"} ${a.dias} día(s).`;
}

export function AlertasPropiasPanel({ alertas }: { alertas: AlertaPropiaCalculada[] }) {
  if (alertas.length === 0) return null;
  const grupos = new Map<string, AlertaPropiaCalculada[]>();
  for (const a of alertas) grupos.set(a.alertaId, [...(grupos.get(a.alertaId) ?? []), a]);

  return (
    <>
      {[...grupos.values()].map((lista) => (
        <div key={lista[0].alertaId} className="mb-8 rounded-lg border border-red-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-red-600">Alertas de {lista[0].alertaNombre}</h2>
          {lista[0].fundamento && <p className="mb-3 text-xs text-gray-500">Norma: {lista[0].fundamento}</p>}
          <ul className="mt-2 space-y-2">
            {lista.map((a) => (
              <li
                key={`${a.alertaId}-${a.id}`}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${
                  a.level === "red" ? "bg-red-50" : "bg-yellow-50"
                }`}
              >
                <span className="text-ink">
                  <MensajeDeAlerta level={a.level} numeroEconomico={a.numeroEconomico} texto={mensaje(a)} />{" "}
                  <span className="text-gray-500">({a.cityName})</span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.level === "red" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    Vence {formatDate(a.vencimiento)}
                  </span>
                  <Link
                    href={`/ciudades/${a.citySlug}/vehiculo/${a.id}${a.ancla}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {verRecordLabel(a.sectionSlug)} →
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
