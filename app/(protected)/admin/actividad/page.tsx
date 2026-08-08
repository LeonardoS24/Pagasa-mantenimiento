import Link from "next/link";
import { getSystemActivityFeed } from "@/lib/activity-log";
import { formatDate } from "@/lib/dates";

// Todo lo nuevo que se agrega en el sistema (unidades, equipos,
// mantenimientos y el resto de los tipos de registro), de qué ciudad es y
// qué usuario lo hizo. La protección de esta ruta ya la da
// app/(protected)/admin/layout.tsx (requireAdmin).
export default async function ActividadPage() {
  const eventos = await getSystemActivityFeed();

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink">
        Los {eventos.length} registros más recientes agregados en todo el sistema, de cualquier
        ciudad.
      </p>
      {eventos.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
          Todavía no hay actividad registrada.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {eventos.map((evento) => (
            <li key={evento.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <div className="text-sm text-ink">
                <span className="font-medium text-primary">{formatDate(evento.createdAt)}</span>
                {" · "}
                <Link href={evento.href} className="font-medium text-primary hover:underline">
                  {evento.detalle}
                </Link>
                <span className="text-gray-500"> ({evento.cityName})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {evento.tipo}
                </span>
                <span className="text-xs text-gray-500">
                  {evento.createdByUsername ?? "Desconocido"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
