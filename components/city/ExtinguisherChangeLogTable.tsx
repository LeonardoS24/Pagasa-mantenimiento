import type { ExtinguisherChangeLog, Document } from "@prisma/client";
import { ExtinguisherChangeLogRow } from "./ExtinguisherChangeLogRow";

export function ExtinguisherChangeLogTable({
  logs,
  canEdit,
  isAdmin,
}: {
  logs: (ExtinguisherChangeLog & { documents: Document[] })[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin cambios de extintor registrados todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <ExtinguisherChangeLogRow key={log.id} log={log} canEdit={canEdit} isAdmin={isAdmin} />
      ))}
    </ul>
  );
}
