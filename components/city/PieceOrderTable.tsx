import type { PieceOrder } from "@prisma/client";
import { formatDate } from "@/lib/dates";
import {
  pieceOrderStatusLabels,
  pieceOrderStatusStyles,
  type PieceOrderStatus,
} from "@/lib/inventory-enums";
import { PieceOrderStatusForm } from "@/components/admin/PieceOrderStatusForm";
import { deletePieceOrder } from "@/actions/piece-order-actions";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

export function PieceOrderTable({
  orders,
  canEdit,
  isAdmin,
}: {
  orders: PieceOrder[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (orders.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay órdenes de pieza registradas.
      </p>
    );
  }

  const sorted = [...orders].sort((a, b) => b.fechaOrden.getTime() - a.fechaOrden.getTime());

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-2">Pieza</th>
            <th className="whitespace-nowrap px-4 py-2">Cantidad</th>
            <th className="whitespace-nowrap px-4 py-2">Fecha de la orden</th>
            <th className="whitespace-nowrap px-4 py-2">Estado</th>
            {isAdmin && <th className="whitespace-nowrap px-4 py-2" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((order) => {
            const estado = order.estado as PieceOrderStatus;
            return (
              <tr key={order.id} className="border-t border-gray-100">
                <td className="whitespace-nowrap px-4 py-2 font-medium text-ink">{order.pieza}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{order.cantidad ?? "—"}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{formatDate(order.fechaOrden)}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  {canEdit ? (
                    <PieceOrderStatusForm orderId={order.id} estado={order.estado} />
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${pieceOrderStatusStyles[estado]}`}
                    >
                      {pieceOrderStatusLabels[estado]}
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td className="whitespace-nowrap px-4 py-2">
                    <form action={deletePieceOrder.bind(null, order.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={`¿Eliminar la orden de "${order.pieza}"?`}
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
