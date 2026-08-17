import type { EquipmentLog, Document } from "@prisma/client";
import { EquipmentLogRow } from "./EquipmentLogRow";

export function EquipmentLogTable({
  logs,
  canEdit,
  isAdmin,
  isPlanta = false,
}: {
  logs: (EquipmentLog & { documents: Document[] })[];
  canEdit: boolean;
  isAdmin: boolean;
  isPlanta?: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin mantenimientos registrados todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <EquipmentLogRow key={log.id} log={log} canEdit={canEdit} isAdmin={isAdmin} isPlanta={isPlanta} />
      ))}
    </ul>
  );
}
