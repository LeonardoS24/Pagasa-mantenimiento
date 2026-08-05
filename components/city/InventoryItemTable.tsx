import Link from "next/link";
import type { InventoryItem } from "@prisma/client";
import { formatDate } from "@/lib/dates";
import {
  inventoryItemStatusLabels,
  inventoryItemStatusStyles,
  ordenTipoLabels,
  formatCantidad,
  describeOrden,
  type InventoryItemStatus,
  type OrdenTipo,
} from "@/lib/inventory-enums";
import { InventoryItemStatusForm, type VehicleOption } from "@/components/admin/InventoryItemStatusForm";
import { deleteInventoryItem } from "@/actions/inventory-actions";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";

type InventoryItemWithVehicle = InventoryItem & {
  usedOnVehicle: { id: string; numeroEconomico: string } | null;
  usedOnMaintenanceLog: { fecha: Date; tipoMantenimiento: string } | null;
  usedOnValveChangeLog: { fechaInstalacion: Date } | null;
  usedOnValveCorrectiveMaintenanceLog: { fecha: Date; descripcion: string } | null;
};

// Segunda línea de "Colocado en": el trabajo concreto donde se usó la pieza.
// Sin esto solo se sabía la unidad, que no alcanza para rastrear una refacción.
function describeTrabajo(item: InventoryItemWithVehicle): string | null {
  if (item.usedOnMaintenanceLog) {
    return `Mantenimiento · ${formatDate(item.usedOnMaintenanceLog.fecha)} · ${item.usedOnMaintenanceLog.tipoMantenimiento}`;
  }
  if (item.usedOnValveChangeLog) {
    return `Cambio de válvulas · ${formatDate(item.usedOnValveChangeLog.fechaInstalacion)}`;
  }
  if (item.usedOnValveCorrectiveMaintenanceLog) {
    return `Correctivo de válvulas · ${formatDate(item.usedOnValveCorrectiveMaintenanceLog.fecha)} · ${item.usedOnValveCorrectiveMaintenanceLog.descripcion}`;
  }
  return null;
}

export function InventoryItemTable({
  items,
  vehicles,
  citySlug,
  canEdit,
  isAdmin,
}: {
  items: InventoryItemWithVehicle[];
  vehicles: VehicleOption[];
  citySlug: string;
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-ink">
        Todavía no hay artículos en inventario.
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
            <th className="whitespace-nowrap px-4 py-2">Nombre</th>
            <th className="whitespace-nowrap px-4 py-2">Orden</th>
            <th className="whitespace-nowrap px-4 py-2">Cantidad</th>
            <th className="whitespace-nowrap px-4 py-2">Fecha</th>
            <th className="whitespace-nowrap px-4 py-2">Estado</th>
            <th className="whitespace-nowrap px-4 py-2">Colocado en</th>
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
                <td className="whitespace-nowrap px-4 py-2 font-medium text-ink">{item.nombre}</td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">
                  {ordenTipoLabels[item.tipo as OrdenTipo] ?? item.tipo}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">
                  {formatCantidad(item.cantidad, item.unidad)}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-ink">{formatDate(fecha)}</td>
                <td className="whitespace-nowrap px-4 py-2">
                  {canEdit && !utilizada ? (
                    <InventoryItemStatusForm
                      itemId={item.id}
                      estado={item.estado}
                      vehicles={vehicles}
                    />
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${inventoryItemStatusStyles[estado]}`}
                    >
                      {inventoryItemStatusLabels[estado]}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-ink">
                  {item.usedOnVehicle ? (
                    <>
                      <Link
                        href={`/ciudades/${citySlug}/vehiculo/${item.usedOnVehicle.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {item.usedOnVehicle.numeroEconomico}
                      </Link>
                      {describeTrabajo(item) && (
                        <span className="block text-xs text-gray-500">{describeTrabajo(item)}</span>
                      )}
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                {isAdmin && (
                  <td className="whitespace-nowrap px-4 py-2">
                    <form action={deleteInventoryItem.bind(null, item.id)}>
                      <ConfirmSubmitButton
                        confirmMessage={`¿Eliminar ${describeOrden(item.tipo, item.nombre, item.cantidad, item.unidad)} del inventario?`}
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
