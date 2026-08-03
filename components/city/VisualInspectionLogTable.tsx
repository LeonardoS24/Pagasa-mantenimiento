import type { VisualInspectionLog, Document } from "@prisma/client";
import { VisualInspectionLogRow } from "./VisualInspectionLogRow";

export function VisualInspectionLogTable({
  logs,
  canEdit,
  isAdmin,
}: {
  logs: (VisualInspectionLog & { documents: Document[] })[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin inspecciones visuales externas registradas todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <VisualInspectionLogRow key={log.id} log={log} canEdit={canEdit} isAdmin={isAdmin} />
      ))}
    </ul>
  );
}
