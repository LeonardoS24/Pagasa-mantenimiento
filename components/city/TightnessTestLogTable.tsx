import type { TightnessTestLog, Document } from "@prisma/client";
import { TightnessTestLogRow } from "./TightnessTestLogRow";

export function TightnessTestLogTable({
  logs,
  canEdit,
  isAdmin,
}: {
  logs: (TightnessTestLog & { documents: Document[] })[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin pruebas de hermeticidad registradas todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <TightnessTestLogRow key={log.id} log={log} canEdit={canEdit} isAdmin={isAdmin} />
      ))}
    </ul>
  );
}
