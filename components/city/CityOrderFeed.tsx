import Link from "next/link";
import type { OrderLogEvent } from "@/lib/city-order-log-feed";
import { pieceOrderStatusLabels, pieceOrderStatusStyles } from "@/lib/inventory-enums";
import { formatCantidad } from "@/lib/inventory-enums";
import { formatDate } from "@/lib/dates";

// Igual que CityMaintenanceFeed (components/city/CityMaintenanceFeed.tsx)
// pero para PieceOrder: una bitácora cronológica de todas las órdenes
// levantadas, mes por mes en Administración (ver isOrdenDePieza en el
// catch-all de ciudad/apartado). No hay una página propia por orden, así
// que el link lleva al apartado "Orden" de esa ciudad, donde vive la tabla
// completa.
export function CityOrderFeed({ orders, showCity = false }: { orders: OrderLogEvent[]; showCity?: boolean }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-ink">
        <p className="text-lg font-medium text-primary">Sin órdenes en la bitácora</p>
        <p className="mt-1 text-sm">Las órdenes de pieza que se levanten en cada ciudad aparecerán aquí, ordenadas por fecha.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {orders.map((order) => (
        <li key={order.id} className="hover:bg-gray-50">
          <Link href={`/ciudades/${order.citySlug}/orden-de-pieza`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <span className="text-sm text-ink">
              <span className="font-medium text-primary">{formatDate(order.fecha)}</span>
              {" · "}
              <span className="font-medium text-ink">{order.nombre}</span>
              {" — "}
              {formatCantidad(order.cantidad, order.unidad)}
              {order.numeroEconomico && <span className="text-gray-500"> · {order.numeroEconomico}</span>}
              {showCity && <span className="text-gray-500"> ({order.cityName})</span>}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${pieceOrderStatusStyles[order.estado]}`}>
              {pieceOrderStatusLabels[order.estado]}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
