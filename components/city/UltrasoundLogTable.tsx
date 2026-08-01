import type { UltrasoundLog, Document } from "@prisma/client";
import { UltrasoundLogRow } from "./UltrasoundLogRow";

export function UltrasoundLogTable({
  logs,
  canEdit,
  isAdmin,
}: {
  logs: (UltrasoundLog & { documents: Document[] })[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin ultrasonidos registrados todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <UltrasoundLogRow key={log.id} log={log} canEdit={canEdit} isAdmin={isAdmin} />
      ))}
    </ul>
  );
}
