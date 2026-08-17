"use client";

import { useState } from "react";
import type { PlantAreaMaintenanceLog } from "@prisma/client";
import { deletePlantAreaMaintenanceLog } from "@/actions/plant-area-actions";
import { formatDate } from "@/lib/dates";
import { ConfirmDeleteRecordWithPassword } from "@/components/admin/ConfirmDeleteRecordWithPassword";

type ChecklistEntry = { item: string; hecho: boolean; observacion?: string };

function parseChecklist(json: string): ChecklistEntry[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function LogRow({ log, isAdmin }: { log: PlantAreaMaintenanceLog; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const checklist = parseChecklist(log.checklist);
  const hechos = checklist.filter((c) => c.hecho).length;

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="text-sm text-ink">
          <span className="font-medium text-primary">{formatDate(log.fecha)}</span>
          {" · "}
          {hechos}/{checklist.length} ítems del checklist realizados
          {log.responsable ? ` · ${log.responsable}` : ""}
        </span>
        <span className="text-xs text-primary">{expanded ? "Ocultar" : "Ver detalle"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 text-sm text-ink">
          <ul className="space-y-1">
            {checklist.map((entry) => (
              <li key={entry.item} className="flex items-start gap-2">
                <span className={entry.hecho ? "text-green-600" : "text-gray-400"}>
                  {entry.hecho ? "✓" : "○"}
                </span>
                <span>
                  {entry.item}
                  {entry.observacion && <span className="text-gray-500"> — {entry.observacion}</span>}
                </span>
              </li>
            ))}
          </ul>
          {log.observaciones && (
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">Observaciones generales</p>
              <p>{log.observaciones}</p>
            </div>
          )}
          {isAdmin && (
            <ConfirmDeleteRecordWithPassword
              mensaje={`¿Eliminar este registro de mantenimiento (${formatDate(log.fecha)})?`}
              action={deletePlantAreaMaintenanceLog.bind(null, log.id)}
              className="text-sm text-accent hover:underline"
            >
              Eliminar registro
            </ConfirmDeleteRecordWithPassword>
          )}
        </div>
      )}
    </li>
  );
}

export function PlantAreaMaintenanceLogTable({
  logs,
  isAdmin,
}: {
  logs: PlantAreaMaintenanceLog[];
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin mantenimientos registrados todavía.</p>;
  }

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <LogRow key={log.id} log={log} isAdmin={isAdmin} />
      ))}
    </ul>
  );
}
