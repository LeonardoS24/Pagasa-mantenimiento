import type { MaintenanceLog, Document } from "@prisma/client";
import { MaintenanceLogRow } from "./MaintenanceLogRow";

export function MaintenanceLogTable({
  logs,
  canEdit,
  isAdmin,
}: {
  logs: (MaintenanceLog & { documents: Document[] })[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin mantenimientos registrados todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <MaintenanceLogRow key={log.id} log={log} canEdit={canEdit} isAdmin={isAdmin} />
      ))}
    </ul>
  );
}
