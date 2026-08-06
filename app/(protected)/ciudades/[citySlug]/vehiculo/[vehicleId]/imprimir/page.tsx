import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { TechnicalSheetView } from "@/components/city/TechnicalSheetView";
import { DocumentList } from "@/components/city/DocumentList";
import { MaintenancePhotos } from "@/components/city/MaintenancePhotos";
import { PrintButton } from "@/components/city/PrintButton";
import { formatDate } from "@/lib/dates";
import { maintenanceStatusLabels, calidadExtintorLabels, type MaintenanceStatus, type CalidadExtintor } from "@/lib/vehicle-enums";
import { valvulaCorrectivaLabels, type ValvulaCorrectiva } from "@/lib/valve-alerts";
import type { Document } from "@prisma/client";

// Vista de solo lectura pensada para imprimirse completa de una sola vez:
// a diferencia de la página normal de la unidad, aquí cada registro se
// muestra siempre expandido (nada depende de clics ni de estado de cliente),
// para que "Imprimir" capture toda la información sin que el usuario tenga
// que abrir cada renglón primero.

const vehiclePrintInclude = {
  section: { include: { city: true } },
  documents: { orderBy: { createdAt: "desc" as const } },
  technicalSheet: true,
  maintenanceLogs: {
    orderBy: { fecha: "desc" as const },
    include: { documents: { orderBy: { createdAt: "desc" as const } } },
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
  return (
    <section className="mb-6 break-inside-avoid rounded-lg border border-gray-200 bg-white p-5 print:border-gray-300">
      <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">{title}</h2>
      {children}
    </section>
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
        <div key={entry.key} className="break-inside-avoid rounded-md border border-gray-100 p-3">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {entry.fields.map((field) => (
              <Field key={field.label} label={field.label} value={field.value} />
            ))}
          </dl>
          <div className="mt-3">
            <MaintenancePhotos documents={entry.documents} isAdmin={false} />
          </div>
          {entry.documents.filter((d) => d.kind === "ADJUNTO").length > 0 && (
            <div className="mt-3">
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
      ))}
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
        {!vehicle.activo && (
          <p className="text-sm font-medium text-orange-700">
            Dado de baja{vehicle.fechaBaja ? ` · ${formatDate(vehicle.fechaBaja)}` : ""}
          </p>
        )}
      </div>

      {printRecords.map((record, index) => {
        const isTanqueCarburacion = record.section.slug === "vehiculo-con-tanque-de-carburacion";
        const isAutoTanques = record.section.slug === "auto-tanques";
        const useDeliveryFormat =
          record.section.slug === "vehiculo-de-reparto" ||
          record.section.slug === "vehiculo-con-tanque-de-carburacion";
        const showTankSection = record.section.slug !== "vehiculo-de-reparto";
        const showInspeccionesSection = isAutoTanques || isTanqueCarburacion;

        return (
          <div key={record.id}>
            {isMerged && (
              <p className="mb-2 mt-8 text-xs font-semibold uppercase tracking-wide text-gray-400 first:mt-0">
                {record.section.name}
              </p>
            )}

            {index === 0 && (
              <Section title="Datos generales">
                <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="Sucursal" value={record.sucursal} />
                  <Field label="Año" value={record.anio} />
                  <Field label="Placas" value={record.placas} />
                  <Field
                    label="Anterior"
                    value={[record.numeroAnterior, record.localidadAnterior].filter(Boolean).join(", ") || null}
                  />
                </dl>
              </Section>
            )}

            <Section title="Ficha técnica">
              <TechnicalSheetView
                sheet={record.technicalSheet}
                sectionSlug={record.section.slug}
                useDeliveryFormat={useDeliveryFormat}
                showValveSection={isTanqueCarburacion}
                showHoseSection={isTanqueCarburacion}
                showTankSection={showTankSection}
                showInspeccionesSection={showInspeccionesSection}
                showMaintenancePreventiveSection={!isTanqueCarburacion}
                showAutomovilSection={index === 0}
              />
            </Section>

            <Section title="Bitácora de mantenimiento">
              <LogList
                emptyLabel="Sin mantenimientos registrados."
                entries={record.maintenanceLogs.map((log) => ({
                  key: log.id,
                  documents: log.documents,
                  fields: [
                    { label: "Fecha", value: formatDate(log.fecha) },
                    { label: "Tipo de mantenimiento", value: log.tipoMantenimiento },
                    { label: "Tipo de servicio", value: log.tipoServicio },
                    { label: "Kilometraje", value: log.kilometraje != null ? `${log.kilometraje.toLocaleString("es-MX")} km` : null },
                    { label: "Categoría de la pieza", value: log.categoriaPieza },
                    { label: "Pieza", value: log.pieza },
                    { label: "Acción realizada en la pieza", value: log.accionPieza },
                    { label: "Cantidad", value: log.cantidad },
                    { label: "Unidad", value: log.unidad },
                    { label: "Estatus", value: maintenanceStatusLabels[log.estatus as MaintenanceStatus] ?? log.estatus },
                    { label: "Nombre del operador", value: log.nombreOperador },
                    { label: "Auxiliar técnico", value: log.auxiliarTecnico },
                    { label: "Responsable del trabajo mecánico", value: log.responsableTrabajoMecanico },
                    { label: "Descripción", value: log.descripcion },
                    { label: "Observación", value: log.observacion },
                  ],
                }))}
              />
            </Section>

            <Section title="Cambio de extintor">
              <LogList
                emptyLabel="Sin cambios de extintor registrados."
                entries={record.extinguisherChangeLogs.map((log) => ({
                  key: log.id,
                  documents: log.documents,
                  fields: [
                    { label: "Fecha de realización", value: formatDate(log.fechaRealizacion) },
                    { label: "Responsable", value: log.responsable },
                    { label: "Fecha de instalación", value: formatDate(log.fechaInstalacion) },
                    { label: "Fecha de vencimiento", value: formatDate(log.fechaVencimiento) },
                    { label: "Calidad", value: calidadExtintorLabels[log.calidad as CalidadExtintor] ?? log.calidad },
                  ],
                }))}
              />
            </Section>

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

            {isTanqueCarburacion && (
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
                      { label: "Responsable", value: log.responsable },
                    ],
                  }))}
                />
              </Section>
            )}

            {isTanqueCarburacion && (
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
              <DocumentList documents={record.documents} isAdmin={false} />
            </Section>
          </div>
        );
      })}
    </div>
  );
}
