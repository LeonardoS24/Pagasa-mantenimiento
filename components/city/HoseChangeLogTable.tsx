import type { HoseChangeLog, Document } from "@prisma/client";
import { HoseChangeLogRow } from "./HoseChangeLogRow";

export function HoseChangeLogTable({
  logs,
  canEdit,
  isAdmin,
}: {
  logs: (HoseChangeLog & { documents: Document[] })[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin cambios de mangueras registrados todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <HoseChangeLogRow key={log.id} log={log} canEdit={canEdit} isAdmin={isAdmin} />
      ))}
    </ul>
  );
}
