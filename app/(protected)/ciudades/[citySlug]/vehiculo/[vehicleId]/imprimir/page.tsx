import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { TechnicalSheetView } from "@/components/city/TechnicalSheetView";
import { StationTankTechnicalSheetView } from "@/components/city/StationTankTechnicalSheetView";
import { DocumentList } from "@/components/city/DocumentList";
import { MaintenancePhotos } from "@/components/city/MaintenancePhotos";
import { PrintButton } from "@/components/city/PrintButton";
import { PieceMaintenanceChart } from "@/components/city/PieceMaintenanceChart";
import { PrintPdfPages } from "@/components/city/PrintPdfPages";
import { getPieceMaintenanceStats } from "@/lib/piece-maintenance-stats";
import { formatDate, getCurrentYearRange, currentYearLabel } from "@/lib/dates";
import {
  maintenanceStatusLabels,
  calidadExtintorLabels,
  calidadMantenimientoLabels,
  type MaintenanceStatus,
  type CalidadExtintor,
  type CalidadMantenimiento,
} from "@/lib/vehicle-enums";
import { valvulaCorrectivaLabels, type ValvulaCorrectiva } from "@/lib/valve-alerts";
import { parseChecklistPreventivo } from "@/lib/preventive-checklist";
import { formatCantidad } from "@/lib/inventory-enums";
import type { Document, MaintenanceLog, InventoryItem } from "@prisma/client";

// Vista de solo lectura pensada para imprimirse completa de una sola vez:
// a diferencia de la página normal de la unidad, aquí cada registro se
// muestra siempre expandido (nada depende de clics ni de estado de cliente),
// para que "Imprimir" capture toda la información sin que el usuario tenga
// que abrir cada renglón primero.

const vehiclePrintInclude = {
  section: { include: { city: true } },
  documents: { orderBy: { createdAt: "desc" as const } },
  technicalSheet: true,
  stationTankTechnicalSheets: { orderBy: { etiqueta: "asc" as const } },
  maintenanceLogs: {
    orderBy: { fecha: "desc" as const },
    include: {
      documents: { orderBy: { createdAt: "desc" as const } },
      piezasUtilizadas: true,
    },
  },
  ultrasoundLogs: {
    orderBy: { fechaRealizacion: "desc" as const },
    include: { documents: { orderBy: { createdAt: "desc" as const } } },
  },
  visualInspectionLogs: {
    orderBy: { fechaRealizacion: "desc" as const },
    include: { documents: { orderBy: { createdAt: "desc" as const } } },
  },
  tightnessTestLogs: {
    orderBy: { fechaRealizacion: "desc" as const },
    include: { documents: { orderBy: { createdAt: "desc" as const } } },
  },
  internalVisualInspectionLogs: {
    orderBy: { fechaRealizacion: "desc" as const },
    include: { documents: { orderBy: { createdAt: "desc" as const } } },
  },
  hydrostaticTestLogs: {
    orderBy: { fechaRealizacion: "desc" as const },
    include: { documents: { orderBy: { createdAt: "desc" as const } } },
  },
  extinguisherChangeLogs: {
    orderBy: { fechaRealizacion: "desc" as const },
    include: { documents: { orderBy: { createdAt: "desc" as const } } },
  },
  valveChangeLogs: {
    orderBy: { fechaInstalacion: "desc" as const },
    include: { documents: { orderBy: { createdAt: "desc" as const } } },
  },
  valveCorrectiveMaintenanceLogs: {
    orderBy: { fecha: "desc" as const },
    include: { documents: { orderBy: { createdAt: "desc" as const } } },
  },
  hoseChangeLogs: {
    orderBy: { fechaInstalacion: "desc" as const },
    include: { documents: { orderBy: { createdAt: "desc" as const } } },
  },
};

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  // Sin break-inside-avoid: en tarjetas grandes (ficha técnica, tanque,
  // etc.) esa regla hacía que el navegador, al no caber la tarjeta completa
  // en lo que quedaba de la hoja, empujara TODA la tarjeta a la siguiente
  // página — dejando un hueco en blanco enorme donde debía seguir la
  // información. Mejor dejar que el contenido fluya y, si acaso, se corte
  // justo en el salto de página.
  return (
    <section className="mb-6 rounded-lg border border-gray-200 bg-white p-5 print:border-gray-300">
      <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">{title}</h2>
      {children}
    </section>
  );
}

// Los PDF que se adjuntaron a un registro, en el formato que espera
// PrintPdfPages. Las imágenes no entran aquí: esas ya se ven como miniatura
// (ver MaintenancePhotos / DocumentList) y sí se imprimen solas.
function pdfsImprimibles(documents: Document[]) {
  return documents
    .filter((d) => d.mimeType === "application/pdf")
    .map((d) => ({ id: d.id, fileName: d.fileName }));
}

// A diferencia de Field, este SÍ pinta el renglón cuando el dato viene vacío.
// En la hoja impresa el registro debe verse como el formato completo que se
// llena —con sus huecos a la vista— y no solo con los campos que alguien
// alcanzó a capturar: si se oculta lo vacío, un registro donde solo se puso la
// fecha se imprime como si el formato fuera de un solo campo.
function FieldSiempre({ label, value }: { label: string; value?: string | null }) {
  const vacio = value === null || value === undefined || value === "";
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt>
      <dd className={vacio ? "text-gray-400" : "text-ink"}>{vacio ? "—" : value}</dd>
    </div>
  );
}

function LogList({
  emptyLabel,
  entries,
}: {
  emptyLabel: string;
  entries: { key: string; fields: { label: string; value?: string | null }[]; documents: Document[] }[];
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-ink">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div key={entry.key}>
          {/* break-inside-avoid solo en los datos del registro, que sí caben
              en una hoja. Las páginas del PDF van FUERA de este recuadro: si
              quedaran dentro, el navegador intentaría no partir un bloque de
              varias hojas y lo empujaría entero a la siguiente página,
              dejando un hueco enorme (mismo motivo que el comentario de
              Section más arriba). */}
          <div className="break-inside-avoid rounded-md border border-gray-100 p-3">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {entry.fields.map((field) => (
                <FieldSiempre key={field.label} label={field.label} value={field.value} />
              ))}
            </dl>
            <div className="mt-3">
              <MaintenancePhotos documents={entry.documents} isAdmin={false} />
            </div>
            {entry.documents.filter((d) => d.kind === "ADJUNTO").length > 0 && (
              <div className="mt-3 print:hidden">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
                  Documentos (PDF o imagen)
                </p>
                <DocumentList
                  documents={entry.documents.filter((d) => d.kind === "ADJUNTO")}
                  isAdmin={false}
                />
              </div>
            )}
          </div>
          {/* Los PDF adjuntos, dibujados página por página justo debajo de su
              registro, para que salgan en la misma impresión. */}
          <PrintPdfPages documents={pdfsImprimibles(entry.documents)} />
        </div>
      ))}
    </div>
  );
}

type MaintenanceLogWithExtras = MaintenanceLog & { documents: Document[]; piezasUtilizadas: InventoryItem[] };

// Mismo estilo que el detalle expandido de un mantenimiento en la página
// normal de la unidad (ver components/city/MaintenanceLogRow.tsx): el
// checklist de mantenimiento preventivo como su propia cuadrícula con cada
// ítem coloreado, no como una sola línea de texto amontonada — eso era lo
// que se veía mal al imprimir.
function MaintenanceLogPrintList({ logs }: { logs: MaintenanceLogWithExtras[] }) {
  if (logs.length === 0) {
    return <p className="text-sm text-ink">Sin mantenimientos registrados.</p>;
  }
  return (
    <div className="space-y-4">
      {logs.map((log) => {
        const checklist = parseChecklistPreventivo(log.checklistPreventivo);
        return (
          <div key={log.id}>
            <div className="break-inside-avoid rounded-md border border-gray-100 p-3">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Fecha" value={formatDate(log.fecha)} />
              <Field label="Tipo de mantenimiento" value={log.tipoMantenimiento} />
              <Field label="Tipo de servicio" value={log.tipoServicio} />
              <Field
                label="Kilometraje"
                value={log.kilometraje != null ? `${log.kilometraje.toLocaleString("es-MX")} km` : null}
              />
              <Field
                label="Calidad general reportada"
                value={log.calidad ? calidadMantenimientoLabels[log.calidad as CalidadMantenimiento] : null}
              />
              <Field label="Categoría de la pieza" value={log.categoriaPieza} />
              <Field label="Pieza" value={log.pieza} />
              <Field label="Acción realizada en la pieza" value={log.accionPieza} />
              <Field label="Cantidad" value={log.cantidad} />
              <Field label="Unidad" value={log.unidad} />
              <Field
                label="Estatus"
                value={maintenanceStatusLabels[log.estatus as MaintenanceStatus] ?? log.estatus}
              />
              <Field label="Nombre del operador" value={log.nombreOperador} />
              <Field label="Auxiliar técnico" value={log.auxiliarTecnico} />
              <Field label="Responsable del trabajo mecánico" value={log.responsableTrabajoMecanico} />
            </dl>

            {log.piezasUtilizadas.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">Pieza de inventario</p>
                <div className="flex flex-wrap gap-1.5">
                  {log.piezasUtilizadas.map((item) => (
                    <span
                      key={item.id}
                      className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700"
                    >
                      {item.nombre} · {formatCantidad(item.cantidad, item.unidad)}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 space-y-3">
              <Field label="Descripción" value={log.descripcion} />
              <Field label="Observación" value={log.observacion} />
            </div>

            {checklist && checklist.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold uppercase text-gray-500">
                  Checklist de mantenimiento preventivo
                </p>
                <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {checklist.map((entry) => (
                    <div key={entry.item} className="text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <dt className="text-ink">{entry.item}</dt>
                        <dd
                          className={
                            entry.estado === "Buen estado" ? "text-gray-500" : "font-medium text-accent"
                          }
                        >
                          {entry.estado}
                          {entry.cantidad && ` (${entry.cantidad})`}
                        </dd>
                      </div>
                      {entry.descripcion && <dd className="mt-0.5 text-gray-500">{entry.descripcion}</dd>}
                    </div>
                  ))}
                </dl>
              </div>
            )}

            <div className="mt-3">
              <MaintenancePhotos documents={log.documents} isAdmin={false} />
            </div>
            {log.documents.filter((d) => d.kind === "ADJUNTO").length > 0 && (
              <div className="mt-3 print:hidden">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-500">
                  Documentos (PDF o imagen)
                </p>
                <DocumentList documents={log.documents.filter((d) => d.kind === "ADJUNTO")} isAdmin={false} />
              </div>
            )}
            </div>
            {/* Fuera del recuadro con break-inside-avoid, por el mismo motivo
                explicado en LogList: un bloque de varias hojas no se debe
                tratar como indivisible. */}
            <PrintPdfPages documents={pdfsImprimibles(log.documents)} />
          </div>
        );
      })}
    </div>
  );
}

export default async function PrintVehiclePage({
  params,
}: {
  params: { citySlug: string; vehicleId: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };

  await assertCityAccess(user, params.citySlug);

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: params.vehicleId },
    include: vehiclePrintInclude,
  });
  if (!vehicle || vehicle.section.city.slug !== params.citySlug) notFound();

  // Auto-Tanques y Vehículo con tanque de carburación pueden ser el mismo
  // camión físico (un solo tanque de carga y un tanque de carburación aparte)
  // capturado como dos registros con el mismo número económico. Al imprimir
  // se combinan en una sola hoja para no repetir la ficha técnica del
  // automóvil, que es idéntica en ambos.
  const pairedSlug =
    vehicle.section.slug === "auto-tanques"
      ? "vehiculo-con-tanque-de-carburacion"
      : vehicle.section.slug === "vehiculo-con-tanque-de-carburacion"
        ? "auto-tanques"
        : null;

  const pairedVehicle = pairedSlug
    ? await prisma.vehicleRecord.findFirst({
        where: {
          numeroEconomico: vehicle.numeroEconomico,
          id: { not: vehicle.id },
          section: { slug: pairedSlug, cityId: vehicle.section.cityId },
        },
        include: vehiclePrintInclude,
      })
    : null;

  const printRecords = pairedVehicle
    ? [vehicle, pairedVehicle].sort((a, b) =>
        a.section.slug === "auto-tanques" ? -1 : b.section.slug === "auto-tanques" ? 1 : 0
      )
    : [vehicle];
  const isMerged = printRecords.length > 1;

  // Piezas con más mantenimiento del año en curso, una por cada unidad
  // impresa (mismo gráfico que la página normal de la unidad, ver
  // components/city/PieceMaintenanceChart.tsx). Se calcula aquí, fuera del
  // .map() de abajo, porque ese es JSX síncrono y esto necesita await.
  // El apartado general "Documentos" puede acumular años de PDF/imágenes;
  // más allá de 3 años ya no se descargan al imprimir (a diferencia de los
  // documentos propios de cada bitácora, que sí siguen apareciendo siempre).
  const documentsCutoff = new Date();
  documentsCutoff.setFullYear(documentsCutoff.getFullYear() - 3);

  const yearRange = getCurrentYearRange();
  const pieceStatsByRecordId = new Map(
    await Promise.all(
      printRecords.map(
        async (record) => [record.id, await getPieceMaintenanceStats(null, 10, yearRange, record.id)] as const
      )
    )
  );

  // "Cuándo se descargó/imprimió": esta página se genera de nuevo en cada
  // visita/impresión, así que la hora del render es la hora de impresión.
  const generatedAt = new Date();

  return (
    <div className="mx-auto max-w-4xl print:max-w-none">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/ciudades/${params.citySlug}/vehiculo/${vehicle.id}`}
          className="text-sm text-primary hover:underline"
        >
          ← Volver al registro
        </Link>
        <PrintButton label="Imprimir esta hoja" />
      </div>

      <div className="mb-6">
        <p className="text-xs text-gray-500">
          {vehicle.section.city.name} · {printRecords.map((record) => record.section.name).join(" + ")}
        </p>
        <h1 className="text-2xl font-semibold text-primary">{vehicle.numeroEconomico}</h1>
        <p className="text-xs text-gray-500">Impreso/descargado el {formatDate(generatedAt)}</p>
        {/* "Datos generales" ya no es su propia sección con recuadro: para no
            gastar una hoja completa solo en unos datos cortos al imprimir,
            pero sí en cuadrícula de etiqueta/valor (como el resto de la
            hoja) en vez de una sola línea corrida. Para una Estación de
            carburación son los mismos datos que su "ficha técnica de la
            estación" (ver la página de detalle: Nombre/Permisionaria/
            Permiso/Dirección juntos, sin separar Dirección a otro lado). */}
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          {vehicle.section.slug === "estaciones-de-carburacion" || vehicle.section.slug === "planta-ficha-tecnica" ? (
            <>
              <Field label="Permisionaria" value={vehicle.permisionaria} />
              <Field label="Permiso" value={vehicle.permiso} />
              <Field label="Dirección" value={vehicle.sucursal} />
            </>
          ) : (
            <>
              <Field label="Marca" value={vehicle.sucursal} />
              <Field label="Año" value={vehicle.anio != null ? String(vehicle.anio) : null} />
              <Field label="Placas" value={vehicle.placas} />
              <Field label="Observaciones" value={vehicle.observaciones} />
            </>
          )}
        </dl>
        {!vehicle.activo && (
          <p className="text-sm font-medium text-orange-700">
            Dado de baja{vehicle.fechaBaja ? ` · ${formatDate(vehicle.fechaBaja)}` : ""}
            {vehicle.motivoBaja ? ` · Motivo: ${vehicle.motivoBaja}` : ""}
          </p>
        )}
      </div>

      {printRecords.map((record, index) => {
        const isTanqueCarburacion = record.section.slug === "vehiculo-con-tanque-de-carburacion";
        const isAutoTanques = record.section.slug === "auto-tanques";
        const isPlantaRecord = record.section.slug === "planta-ficha-tecnica";
        const isEstacionLike = record.section.slug === "estaciones-de-carburacion" || isPlantaRecord;
        const useDeliveryFormat =
          record.section.slug === "vehiculo-de-reparto" ||
          record.section.slug === "vehiculo-con-tanque-de-carburacion";
        // El recuadro del tanque solo se imprime en las unidades que llevan
        // tanque: Auto-Tanques (tanque de carga) y Vehículo con tanque de
        // carburación. Una utilitaria o una del parque vehicular no tiene
        // ninguno, y antes se les imprimía el bloque vacío gastando espacio.
        //
        // A propósito NO se decide por "si trae datos capturados": una unidad
        // de carburación SÍ tiene tanque aunque todavía no lo hayan llenado, y
        // esconderle el bloque taparía que falta capturarlo. Se imprime con
        // sus huecos a la vista, igual que el resto del formato.
        const showTankSection = isAutoTanques || isTanqueCarburacion;
        const showInspeccionesSection = isAutoTanques || isTanqueCarburacion || isEstacionLike;

        const sectionLabel = isAutoTanques
          ? "Auto-Tanques (tanque de carga)"
          : "Vehículo con tanque de carburación";
        const previousSectionLabel =
          index > 0
            ? printRecords[index - 1].section.slug === "auto-tanques"
              ? "Auto-Tanques (tanque de carga)"
              : "Vehículo con tanque de carburación"
            : null;

        return (
          <div key={record.id}>
            {isMerged && (
              <div className="mb-4 mt-6 flex items-center gap-3 first:mt-0">
                <div className="h-0.5 flex-1 bg-primary/40" />
                <p className="whitespace-nowrap rounded-full bg-primary px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white print:bg-primary print:text-white">
                  {previousSectionLabel ? `Termina ${previousSectionLabel} — ` : ""}
                  Inicia {sectionLabel}
                </p>
                <div className="h-0.5 flex-1 bg-primary/40" />
              </div>
            )}

            {isEstacionLike &&
              (record.stationTankTechnicalSheets.length > 0 ? (
                record.stationTankTechnicalSheets.map((tanque) => (
                  <Section
                    key={tanque.id}
                    title={
                      record.stationTankTechnicalSheets.length > 1
                        ? `Ficha técnica del tanque — ${tanque.etiqueta}`
                        : "Ficha técnica del tanque"
                    }
                  >
                    <StationTankTechnicalSheetView sheet={tanque} isPlanta={isPlantaRecord} />
                  </Section>
                ))
              ) : (
                <Section title="Ficha técnica del tanque">
                  <StationTankTechnicalSheetView sheet={null} isPlanta={isPlantaRecord} />
                </Section>
              ))}

            <Section title="Ficha técnica">
              <TechnicalSheetView
                sheet={record.technicalSheet}
                sectionSlug={record.section.slug}
                useDeliveryFormat={useDeliveryFormat}
                showValveSection={isTanqueCarburacion || isAutoTanques}
                showHoseSection={isTanqueCarburacion}
                showTankSection={showTankSection}
                showInspeccionesSection={showInspeccionesSection}
                showMaintenancePreventiveSection={!isTanqueCarburacion || !isMerged}
                showAutomovilSection={index === 0 && !isEstacionLike}
                showExtintorSection={!isTanqueCarburacion || !isMerged}
              />
            </Section>

            <Section title="Piezas con más mantenimiento (año en curso)">
              <PieceMaintenanceChart
                stats={pieceStatsByRecordId.get(record.id) ?? []}
                scope={{ type: "vehicle", vehicleRecordId: record.id }}
                range={yearRange}
                monthLabel={currentYearLabel()}
                periodo="año"
              />
            </Section>

            <Section title="Bitácora de mantenimiento">
              <MaintenanceLogPrintList logs={record.maintenanceLogs} />
            </Section>

            {(!isTanqueCarburacion || !isMerged) && (
              <Section title="Cambio de extintor">
                <LogList
                  emptyLabel="Sin cambios de extintor registrados."
                  entries={record.extinguisherChangeLogs.map((log) => ({
                    key: log.id,
                    documents: log.documents,
                    fields: [
                      { label: "Responsable", value: log.responsable },
                      { label: "Fecha de instalación", value: formatDate(log.fechaInstalacion) },
                      { label: "Fecha de vencimiento", value: formatDate(log.fechaVencimiento) },
                      { label: "Calidad", value: calidadExtintorLabels[log.calidad as CalidadExtintor] ?? log.calidad },
                    ],
                  }))}
                />
              </Section>
            )}

            {isTanqueCarburacion && (
              <Section title="Cambio de mangueras">
                <LogList
                  emptyLabel="Sin cambios de mangueras registrados."
                  entries={record.hoseChangeLogs.map((log) => ({
                    key: log.id,
                    documents: log.documents,
                    fields: [
                      { label: "Fecha de instalación", value: formatDate(log.fechaInstalacion) },
                      { label: "Fecha de fabricación de la manguera", value: formatDate(log.fechaFabricacionManguera) },
                      { label: "Responsable", value: log.responsable },
                    ],
                  }))}
                />
              </Section>
            )}

            {(isTanqueCarburacion || isAutoTanques) && (
              <Section title="Cambio de válvulas">
                <LogList
                  emptyLabel="Sin cambios de válvulas registrados."
                  entries={record.valveChangeLogs.map((log) => ({
                    key: log.id,
                    documents: log.documents,
                    fields: [
                      { label: "Fecha de instalación", value: formatDate(log.fechaInstalacion) },
                      { label: "Válvula de llenado", value: formatDate(log.fechaFabricacionValvulaLlenado) },
                      { label: "Válvula de servicio", value: formatDate(log.fechaFabricacionValvulaServicio) },
                      { label: "Válvula de máximo llenado", value: formatDate(log.fechaFabricacionValvulaMaximoLlenado) },
                      { label: "Válvula de alivio (seguridad)", value: formatDate(log.fechaFabricacionValvulaAlivio) },
                      { label: "Responsable de cambio/instalación", value: log.responsableCambio },
                      { label: "Responsable de supervisión y control", value: log.responsableSupervision },
                    ],
                  }))}
                />
              </Section>
            )}

            {(isTanqueCarburacion || isAutoTanques) && (
              <Section title="Mantenimiento correctivo de válvulas">
                <LogList
                  emptyLabel="Sin mantenimientos correctivos registrados."
                  entries={record.valveCorrectiveMaintenanceLogs.map((log) => ({
                    key: log.id,
                    documents: log.documents,
                    fields: [
                      { label: "Fecha", value: formatDate(log.fecha) },
                      {
                        label: "Válvula afectada",
                        value: valvulaCorrectivaLabels[log.valvula as ValvulaCorrectiva] ?? log.valvula,
                      },
                      { label: "Responsable", value: log.responsable },
                      { label: "Descripción de la reparación", value: log.descripcion },
                    ],
                  }))}
                />
              </Section>
            )}

            {showInspeccionesSection && (
              <Section title="Inspección Visual Externa">
                <LogList
                  emptyLabel="Sin inspecciones visuales externas registradas."
                  entries={record.visualInspectionLogs.map((log) => ({
                    key: log.id,
                    documents: log.documents,
                    fields: [
                      { label: "Fecha de realización", value: formatDate(log.fechaRealizacion) },
                      { label: "Compañía", value: log.compania },
                      { label: "Número de inspección", value: log.numeroInspeccion },
                      { label: "Responsable", value: log.responsable },
                      { label: "Fecha de inspección anterior", value: formatDate(log.fechaUltimaInspeccion) },
                    ],
                  }))}
                />
              </Section>
            )}

            {showInspeccionesSection && (
              <Section title="Prueba de Hermeticidad">
                <LogList
                  emptyLabel="Sin pruebas de hermeticidad registradas."
                  entries={record.tightnessTestLogs.map((log) => ({
                    key: log.id,
                    documents: log.documents,
                    fields: [
                      { label: "Fecha de realización", value: formatDate(log.fechaRealizacion) },
                      { label: "Compañía", value: log.compania },
                      { label: "Número de prueba", value: log.numeroPrueba },
                      { label: "Responsable", value: log.responsable },
                      { label: "Fecha de prueba anterior", value: formatDate(log.fechaUltimaPrueba) },
                    ],
                  }))}
                />
              </Section>
            )}

            {showInspeccionesSection && (
              <Section title="Inspección Visual Interna">
                <LogList
                  emptyLabel="Sin inspecciones visuales internas registradas."
                  entries={record.internalVisualInspectionLogs.map((log) => ({
                    key: log.id,
                    documents: log.documents,
                    fields: [
                      { label: "Fecha de realización", value: formatDate(log.fechaRealizacion) },
                      { label: "Compañía", value: log.compania },
                      { label: "Número de inspección", value: log.numeroInspeccion },
                      { label: "Responsable", value: log.responsable },
                      { label: "Fecha de inspección anterior", value: formatDate(log.fechaUltimaInspeccion) },
                    ],
                  }))}
                />
              </Section>
            )}

            {showInspeccionesSection && (
              <Section title="Registro de ultrasonido">
                <LogList
                  emptyLabel="Sin ultrasonidos registrados."
                  entries={record.ultrasoundLogs.map((log) => ({
                    key: log.id,
                    documents: log.documents,
                    fields: [
                      { label: "Fecha de realización", value: formatDate(log.fechaRealizacion) },
                      { label: "Compañía", value: log.compania },
                      { label: "Número de ultrasonido", value: log.numeroUltrasonido },
                      { label: "Responsable", value: log.responsable },
                      { label: "Fecha de ultrasonido anterior", value: formatDate(log.fechaUltimoUltrasonido) },
                    ],
                  }))}
                />
              </Section>
            )}

            {showInspeccionesSection && (
              <Section title="Prueba Hidrostática">
                <LogList
                  emptyLabel="Sin pruebas hidrostáticas registradas."
                  entries={record.hydrostaticTestLogs.map((log) => ({
                    key: log.id,
                    documents: log.documents,
                    fields: [
                      { label: "Fecha de realización", value: formatDate(log.fechaRealizacion) },
                      { label: "Compañía", value: log.compania },
                      { label: "Número de prueba", value: log.numeroPrueba },
                      { label: "Responsable", value: log.responsable },
                      { label: "Fecha de prueba anterior", value: formatDate(log.fechaUltimaPrueba) },
                    ],
                  }))}
                />
              </Section>
            )}

            <Section title="Documentos (PDF o imagen)">
              <DocumentList
                documents={record.documents.filter((d) => d.kind !== "PERMISO" && d.createdAt >= documentsCutoff)}
                isAdmin={false}
              />
            </Section>


            {isMerged && index === printRecords.length - 1 && (
              <div className="mb-4 mt-10 flex items-center gap-3 break-inside-avoid">
                <div className="h-0.5 flex-1 bg-primary/40" />
                <p className="whitespace-nowrap rounded-full bg-primary px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white print:bg-primary print:text-white">
                  Termina {sectionLabel}
                </p>
                <div className="h-0.5 flex-1 bg-primary/40" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
