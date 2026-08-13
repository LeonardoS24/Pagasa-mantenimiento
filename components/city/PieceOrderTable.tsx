import Link from "next/link";
import type { PieceOrder } from "@prisma/client";
import { formatDate } from "@/lib/dates";
import {
  pieceOrderStatusLabels,
  pieceOrderStatusStyles,
  pieceOrderPrioridadLabels,
  pieceOrderPrioridadStyles,
  ordenTipoLabels,
  formatCantidad,
  describeOrden,
  type PieceOrderStatus,
  type PieceOrderPrioridad,
  type OrdenTipo,
} from "@/lib/inventory-enums";
import { PieceOrderStatusForm } from "@/components/admin/PieceOrderStatusForm";
import { deletePieceOrder } from "@/actions/piece-order-actions";
import { ConfirmDeleteRecordWithPassword } from "@/components/admin/ConfirmDeleteRecordWithPassword";

type PieceOrderWithVehicle = PieceOrder & {
  vehicleRecord: { id: string; numeroEconomico: string } | null;
};

export function PieceOrderTable({
  orders,
  canEdit,
  isAdmin,
  citySlug,
}: {
  orders: PieceOrderWithVehicle[];
  canEdit: boolean;
  isAdmin: boolean;
  citySlug: string;
}) {
  if (orders.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay órdenes registradas.
      </p>
    );
  }

  // Las de prioridad ALTA (unidad en mal estado) siempre arriba, sin importar
  // la fecha de la orden.
  const sorted = [...orders].sort((a, b) => {
    if (a.prioridad !== b.prioridad) return a.prioridad === "ALTA" ? -1 : 1;
    return b.fechaOrden.getTime() - a.fechaOrden.getTime();
  });

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="whitespace-nowrap px-4 py-2">Nombre</th>
            <th className="whitespace-nowrap px-4 py-2">Prioridad</th>
            <th className="whitespace-nowrap px-4 py-2">Orden</th>
            <th className="whitespace-nowrap px-4 py-2">Cantidad</th>
            <th className="whitespace-nowrap px-4 py-2">Fecha de la orden</th>
            <th className="whitespace-nowrap px-4 py-2">Unidad destino</th>
            <th className="whitespace-nowrap px-4 py-2">Estado</th>
            {isAdmin && <th className="whitespace-nowrap px-4 py-2" />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((order) => {
            const estado = order.estado as PieceOrderStatus;
            const prioridad = order.prioridad as PieceOrderPrioridad;
            return (
              <tr key={order.id} className="border-t border-gray-100">
                <td className="whitespace-nowrap px-4 py-2 font-medium text-ink">{order.nombre}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  {prioridad === "ALTA" ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${pieceOrderPrioridadStyles[prioridad]}`}
                    >
                      {pieceOrderPrioridadLabels[prioridad]}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">
                  {ordenTipoLabels[order.tipo as OrdenTipo] ?? order.tipo}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">
                  {formatCantidad(order.cantidad, order.unidad)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{formatDate(order.fechaOrden)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">
                  {order.vehicleRecord ? (
                    <Link
                      href={`/ciudades/${citySlug}/vehiculo/${order.vehicleRecord.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {order.vehicleRecord.numeroEconomico}
                    </Link>
                  ) : (
                    "—"
                  )}
                </td>
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
                    <ConfirmDeleteRecordWithPassword
                      mensaje={`¿Eliminar la orden de ${describeOrden(order.tipo, order.nombre, order.cantidad, order.unidad)}?`}
                      action={deletePieceOrder.bind(null, order.id)}
                      className="text-xs text-accent hover:underline"
                    >
                      Eliminar
                    </ConfirmDeleteRecordWithPassword>
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
