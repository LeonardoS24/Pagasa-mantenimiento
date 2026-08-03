import type { ValveCorrectiveMaintenanceLog, Document } from "@prisma/client";
import { ValveCorrectiveMaintenanceLogRow } from "./ValveCorrectiveMaintenanceLogRow";

export function ValveCorrectiveMaintenanceLogTable({
  logs,
  canEdit,
  isAdmin,
}: {
  logs: (ValveCorrectiveMaintenanceLog & { documents: Document[] })[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin mantenimientos correctivos registrados todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <ValveCorrectiveMaintenanceLogRow key={log.id} log={log} canEdit={canEdit} isAdmin={isAdmin} />
      ))}
    </ul>
  );
}
