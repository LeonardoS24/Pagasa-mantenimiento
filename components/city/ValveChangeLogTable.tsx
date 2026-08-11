import type { ValveChangeLog, Document } from "@prisma/client";
import { ValveChangeLogRow } from "./ValveChangeLogRow";

export function ValveChangeLogTable({
  logs,
  canEdit,
  isAdmin,
  sectionSlug,
}: {
  logs: (ValveChangeLog & { documents: Document[] })[];
  canEdit: boolean;
  isAdmin: boolean;
  sectionSlug: string;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin cambios de válvulas registrados todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <ValveChangeLogRow
          key={log.id}
          log={log}
          canEdit={canEdit}
          isAdmin={isAdmin}
          sectionSlug={sectionSlug}
        />
      ))}
    </ul>
  );
}
