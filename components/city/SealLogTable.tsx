"use client";

import { useFormState } from "react-dom";
import type { SealLog } from "@prisma/client";
import type { ActionState } from "@/actions/user-actions";
import { formatDate } from "@/lib/dates";
import { deactivateSealLog, deleteSealLog } from "@/actions/seal-actions";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { ConfirmDeleteRecordWithPassword } from "@/components/admin/ConfirmDeleteRecordWithPassword";

const initialState: ActionState = {};

function ActiveRow({ log, canEdit }: { log: SealLog; canEdit: boolean }) {
  const [state, formAction] = useFormState(deactivateSealLog.bind(null, log.id), initialState);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
      <span className="text-ink">
        <span className="font-medium text-primary">{log.numeroSello}</span>
        {" — instalado "}
        {formatDate(log.fechaInstalacion)}
      </span>
      {canEdit && (
        <form action={formAction} className="flex flex-col items-end gap-1">
          <ConfirmSubmitButton
            confirmMessage={`¿Dar de baja el sello "${log.numeroSello}"? Seguirá apareciendo en el historial.`}
            confirmLabel="Sí, dar de baja"
            pendingLabel="Guardando..."
            className="shrink-0 rounded-md border border-orange-300 px-3 py-1 text-xs font-medium text-orange-700 hover:bg-orange-50"
            extraContent={
              <textarea
                name="motivo"
                rows={2}
                maxLength={500}
                placeholder="Motivo (opcional): se cortó, se cambió por mantenimiento..."
                className="w-full max-w-xs rounded-md border border-gray-300 p-2 text-xs text-ink focus:border-primary focus:outline-none"
              />
            }
          >
            Dar de baja
          </ConfirmSubmitButton>
          {state.error && <span className="text-xs text-red-600">{state.error}</span>}
        </form>
      )}
    </li>
  );
}

type SealLogConDeactivatedBy = SealLog & { deactivatedBy: { username: string } | null };

function HistoryRow({ log, isAdmin }: { log: SealLogConDeactivatedBy; isAdmin: boolean }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
      <span className="text-gray-500">
        <span className="font-medium">{log.numeroSello}</span>
        {" — instalado "}
        {formatDate(log.fechaInstalacion)}
        {log.fechaBaja && `, dado de baja ${formatDate(log.fechaBaja)}`}
        {log.deactivatedBy && ` por ${log.deactivatedBy.username}`}
        {log.motivoBaja && ` (${log.motivoBaja})`}
      </span>
      {isAdmin && (
        <ConfirmDeleteRecordWithPassword
          mensaje={`¿Eliminar el sello "${log.numeroSello}" del historial? Esto no se puede deshacer.`}
          action={deleteSealLog.bind(null, log.id)}
          className="shrink-0 text-xs text-accent hover:underline"
        >
          Eliminar
        </ConfirmDeleteRecordWithPassword>
      )}
    </li>
  );
}

// Sellos de seguridad de una Estación: los activos (instalados ahora) van
// arriba con su botón de dar de baja; los que ya se cortaron o cambiaron
// quedan como historial abajo, sin poderse editar — solo un ADMIN puede
// borrar uno del historial, y solo para corregir un error de captura.
export function SealLogTable({
  logs,
  canEdit,
  isAdmin,
}: {
  logs: SealLogConDeactivatedBy[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin sellos registrados todavía.</p>;
  }

  const activos = logs.filter((log) => log.activo).sort((a, b) => b.fechaInstalacion.getTime() - a.fechaInstalacion.getTime());
  const historial = logs
    .filter((log) => !log.activo)
    .sort((a, b) => (b.fechaBaja?.getTime() ?? 0) - (a.fechaBaja?.getTime() ?? 0));

  return (
    <div className="space-y-3">
      {activos.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Activos</p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
            {activos.map((log) => (
              <ActiveRow key={log.id} log={log} canEdit={canEdit} />
            ))}
          </ul>
        </div>
      )}
      {historial.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Historial (dados de baja)</p>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-gray-50">
            {historial.map((log) => (
              <HistoryRow key={log.id} log={log} isAdmin={isAdmin} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
