import Link from "next/link";
import type { InventoryFeedItem } from "@/lib/city-inventory-feed";
import { formatDate } from "@/lib/dates";
import { inventoryItemStatusLabels, inventoryItemStatusStyles, ordenTipoLabels, formatCantidad, type OrdenTipo } from "@/lib/inventory-enums";

// Vista de solo lectura de todo el inventario, de todas las ciudades juntas
// (ver getCityInventoryFeed en lib/city-inventory-feed.ts). Editar un
// renglón concreto (estado, borrar) se sigue haciendo desde el apartado
// Inventarios de su propia ciudad — el link "Ver" lleva justo ahí.
export function InventoryAggregateTable({ items }: { items: InventoryFeedItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay artículos en inventario en ninguna ciudad.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-2">Ciudad</th>
            <th className="whitespace-nowrap px-4 py-2">Nombre</th>
            <th className="whitespace-nowrap px-4 py-2">Orden</th>
            <th className="whitespace-nowrap px-4 py-2">Cantidad</th>
            <th className="whitespace-nowrap px-4 py-2">Fecha</th>
            <th className="whitespace-nowrap px-4 py-2">Estado</th>
            <th className="whitespace-nowrap px-4 py-2">Colocado en</th>
            <th className="whitespace-nowrap px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const utilizada = item.estado === "UTILIZADA";
            const fecha = utilizada ? item.fechaUtilizada ?? item.fechaIngreso : item.fechaIngreso;
            return (
              <tr
                key={item.id}
                className={`border-t border-gray-100 ${utilizada ? "bg-gray-50 opacity-70" : ""}`}
              >
                <td className="whitespace-nowrap px-4 py-2 text-ink">{item.cityName}</td>
                <td className="whitespace-nowrap px-4 py-2 font-medium text-ink">{item.nombre}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">
                  {ordenTipoLabels[item.tipo as OrdenTipo] ?? item.tipo}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">
                  {formatCantidad(item.cantidad, item.unidad)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{formatDate(fecha)}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${inventoryItemStatusStyles[item.estado]}`}
                  >
                    {inventoryItemStatusLabels[item.estado]}
                  </span>
                </td>
                <td className="px-4 py-2 text-ink">
                  {item.usedOnVehicle ? (
                    <Link
                      href={`/ciudades/${item.citySlug}/vehiculo/${item.usedOnVehicle.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {item.usedOnVehicle.numeroEconomico}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2">
                  <Link
                    href={`/ciudades/${item.citySlug}/inventarios`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Ver →
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
