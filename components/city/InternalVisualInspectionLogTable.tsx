import type { InternalVisualInspectionLog, Document } from "@prisma/client";
import { InternalVisualInspectionLogRow } from "./InternalVisualInspectionLogRow";

export function InternalVisualInspectionLogTable({
  logs,
  canEdit,
  isAdmin,
}: {
  logs: (InternalVisualInspectionLog & { documents: Document[] })[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin inspecciones visuales internas registradas todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <InternalVisualInspectionLogRow key={log.id} log={log} canEdit={canEdit} isAdmin={isAdmin} />
      ))}
    </ul>
  );
}
