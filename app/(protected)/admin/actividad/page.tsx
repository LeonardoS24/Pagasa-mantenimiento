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
        Los {eventos.length} eventos más recientes de todo el sistema: lo que se agregó, lo que se
        editó y lo que se eliminó, de cualquier ciudad.
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
                {evento.href ? (
                  <Link href={evento.href} className="font-medium text-primary hover:underline">
                    {evento.detalle}
                  </Link>
                ) : (
                  <span className="font-medium text-ink">{evento.detalle}</span>
                )}
                {evento.cityName && <span className="text-gray-500"> ({evento.cityName})</span>}
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    evento.tipo === "Eliminado"
                      ? "bg-red-100 text-red-700"
                      : evento.tipo === "Editado"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-700"
                  }`}
                >
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
