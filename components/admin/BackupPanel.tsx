"use client";

import { useState, useTransition } from "react";
import { runBackupNow } from "@/actions/backup-actions";
import { formatDate } from "@/lib/dates";

export type BackupEntry = { name: string; date: string };

// Respaldo automático diario de prisma/dev.db y uploads/ a backups/ (ver
// lib/backup.ts, agendado desde instrumentation.ts). Aquí se puede forzar
// uno de inmediato y ver los últimos que se guardaron.
export function BackupPanel({ backups }: { backups: BackupEntry[] }) {
  const [isPending, startTransition] = useTransition();
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold uppercase text-primary-bright">
          Respaldar ahora
        </h2>
        <p className="mb-4 text-xs text-gray-500">
          Copia completa de la base de datos y de todos los archivos subidos (uploads/). Se hace
          sola una vez al día; usa este botón si necesitas uno de inmediato, por ejemplo antes de
          un cambio grande. Se conservan los últimos 5 respaldos, los más viejos se borran solos.
        </p>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setMensaje(null);
            setError(null);
            startTransition(async () => {
              const result = await runBackupNow();
              if (result.error) setError(result.error);
              else setMensaje(result.success ?? "Respaldo creado.");
            });
          }}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark disabled:opacity-60"
        >
          {isPending ? "Respaldando..." : "Respaldar ahora"}
        </button>
        {mensaje && <p className="mt-2 text-sm text-green-700">{mensaje}</p>}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
          Respaldos guardados
        </h2>
        {backups.length === 0 ? (
          <p className="text-sm text-ink">
            Todavía no hay ningún respaldo. Se creará uno solo la próxima vez que arranque el
            servidor, o al presionar &quot;Respaldar ahora&quot;.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {backups.map((backup) => (
              <li key={backup.name} className="py-2 text-sm text-ink">
                {formatDate(new Date(backup.date))}{" "}
                <span className="text-xs text-gray-500">
                  ({new Date(backup.date).toLocaleTimeString("es-MX")})
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
