import type { HydrostaticTestLog, Document } from "@prisma/client";
import { HydrostaticTestLogRow } from "./HydrostaticTestLogRow";

export function HydrostaticTestLogTable({
  logs,
  canEdit,
  isAdmin,
}: {
  logs: (HydrostaticTestLog & { documents: Document[] })[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin pruebas hidrostáticas registradas todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <HydrostaticTestLogRow key={log.id} log={log} canEdit={canEdit} isAdmin={isAdmin} />
      ))}
    </ul>
  );
}
