import type { InventoryItem } from "@prisma/client";
import { formatDate } from "@/lib/dates";
import {
  inventoryItemStatusLabels,
  inventoryItemStatusStyles,
  type InventoryItemStatus,
} from "@/lib/inventory-enums";
import { InventoryItemStatusForm } from "@/components/admin/InventoryItemStatusForm";
import { deleteInventoryItem } from "@/actions/inventory-actions";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

export function InventoryItemTable({
  items,
  canEdit,
  isAdmin,
}: {
  items: InventoryItem[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay piezas en inventario.
      </p>
    );
  }

  // Las piezas "Utilizada" quedan como registro pero siempre al final,
  // igual que una unidad dada de baja; el resto se ordena por fecha.
  const activos = items
    .filter((item) => item.estado !== "UTILIZADA")
    .sort((a, b) => b.fechaIngreso.getTime() - a.fechaIngreso.getTime());
  const utilizadas = items
    .filter((item) => item.estado === "UTILIZADA")
    .sort((a, b) => (b.fechaUtilizada?.getTime() ?? 0) - (a.fechaUtilizada?.getTime() ?? 0));
  const sorted = [...activos, ...utilizadas];

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-2">Pieza</th>
            <th className="whitespace-nowrap px-4 py-2">Cantidad</th>
            <th className="whitespace-nowrap px-4 py-2">Fecha</th>
            <th className="whitespace-nowrap px-4 py-2">Estado</th>
            {isAdmin && <th className="whitespace-nowrap px-4 py-2" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((item) => {
            const estado = item.estado as InventoryItemStatus;
            const utilizada = estado === "UTILIZADA";
            const fecha = utilizada ? item.fechaUtilizada ?? item.fechaIngreso : item.fechaIngreso;
            return (
              <tr
                key={item.id}
                className={`border-t border-gray-100 ${utilizada ? "bg-gray-50 opacity-70" : ""}`}
              >
                <td className="whitespace-nowrap px-4 py-2 font-medium text-ink">{item.pieza}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{item.cantidad ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{formatDate(fecha)}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  {canEdit && !utilizada ? (
                    <InventoryItemStatusForm itemId={item.id} estado={item.estado} />
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${inventoryItemStatusStyles[estado]}`}
                    >
                      {inventoryItemStatusLabels[estado]}
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td className="whitespace-nowrap px-4 py-2">
                    <form action={deleteInventoryItem.bind(null, item.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={`¿Eliminar "${item.pieza}" del inventario?`}
                        className="text-xs text-accent hover:underline"
                      >
                        Eliminar
                      </ConfirmSubmitButton>
                    </form>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
