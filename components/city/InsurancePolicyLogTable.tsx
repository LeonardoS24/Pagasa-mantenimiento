"use client";

import { useState } from "react";
import type { Document, InsurancePolicyLog } from "@prisma/client";
import { deleteInsurancePolicyLog } from "@/actions/insurance-policy-actions";
import { formatDate } from "@/lib/dates";
import {
  getInsuranceAlertLevel,
  insuranceAlertBadgeStyles,
  insuranceAlertLabel,
} from "@/lib/insurance-alerts";
import { DocumentList } from "./DocumentList";
import { UploadInsurancePolicyDocumentForm } from "@/components/admin/UploadInsurancePolicyDocumentForm";
import { ConfirmDeleteRecordWithPassword } from "@/components/admin/ConfirmDeleteRecordWithPassword";

type LogConDocumentos = InsurancePolicyLog & { documents: Document[] };

function Row({
  log,
  canEdit,
  isAdmin,
  esVigente,
}: {
  log: LogConDocumentos;
  canEdit: boolean;
  isAdmin: boolean;
  esVigente: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  // La alerta solo tiene sentido en la póliza vigente: una vieja siempre está
  // vencida y llenaría la pantalla de rojo sin que signifique nada.
  const level = esVigente ? getInsuranceAlertLevel(log.fechaVencimiento) : "none";

  return (
    <li className="px-4 py-3">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
      >
        <span className="text-sm text-ink">
          <span className="font-medium text-primary">{formatDate(log.fechaRealizacion)}</span>
          {" → vence "}
          {formatDate(log.fechaVencimiento)}
          {log.aseguradora ? ` · ${log.aseguradora}` : ""}
          {esVigente && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Vigente
            </span>
          )}
          {level !== "none" && (
            <span
              className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${insuranceAlertBadgeStyles[level]}`}
            >
              {insuranceAlertLabel(level, log.fechaVencimiento)}
            </span>
          )}
        </span>
        <span className="text-xs text-primary">{expanded ? "Ocultar" : "Ver detalle"}</span>
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3 text-sm text-ink">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">Aseguradora</dt>
              <dd>{log.aseguradora || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">Número de póliza</dt>
              <dd>{log.numeroPoliza || "—"}</dd>
            </div>
            {log.observaciones && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-semibold uppercase text-gray-500">Observaciones</dt>
                <dd className="whitespace-pre-wrap">{log.observaciones}</dd>
              </div>
            )}
          </dl>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Documento de la póliza</p>
            <div className="space-y-2">
              {canEdit && <UploadInsurancePolicyDocumentForm insurancePolicyLogId={log.id} />}
              <DocumentList documents={log.documents} isAdmin={isAdmin} />
            </div>
          </div>

          {isAdmin && (
            <ConfirmDeleteRecordWithPassword
              mensaje={`¿Eliminar esta póliza (${formatDate(log.fechaRealizacion)})? También se eliminarán sus documentos.`}
              action={deleteInsurancePolicyLog.bind(null, log.id)}
              className="text-sm text-accent hover:underline"
            >
              Eliminar póliza
            </ConfirmDeleteRecordWithPassword>
          )}
        </div>
      )}
    </li>
  );
}

export function InsurancePolicyLogTable({
  logs,
  canEdit,
  isAdmin,
}: {
  logs: LogConDocumentos[];
  canEdit: boolean;
  isAdmin: boolean;
}) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin pólizas de seguro registradas todavía.</p>;
  }

  // La vigente es la de vencimiento más lejano, no la última capturada: si se
  // registra después una póliza vieja, la vigente sigue siendo la otra (mismo
  // criterio que usa la alerta en lib/vehicle-alerts-summary.ts).
  const idVigente = [...logs].sort(
    (a, b) => b.fechaVencimiento.getTime() - a.fechaVencimiento.getTime()
  )[0]?.id;

  return (
    <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
      {logs.map((log) => (
        <Row
          key={log.id}
          log={log}
          canEdit={canEdit}
          isAdmin={isAdmin}
          esVigente={log.id === idVigente}
        />
      ))}
    </ul>
  );
}
