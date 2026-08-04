import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { TechnicalSheetView } from "@/components/city/TechnicalSheetView";
import { DocumentList } from "@/components/city/DocumentList";
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

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid rounded-lg border border-gray-200 bg-white p-5 print:border-gray-300">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
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
          {entry.documents.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Documentos (PDF)
              </p>
              <DocumentList documents={entry.documents} isAdmin={false} />
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
    include: {
      section: { include: { city: true } },
      documents: { orderBy: { createdAt: "desc" } },
      technicalSheet: true,
      maintenanceLogs: {
        orderBy: { fecha: "desc" },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
      ultrasoundLogs: {
        orderBy: { fechaRealizacion: "desc" },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
      visualInspectionLogs: {
        orderBy: { fechaRealizacion: "desc" },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
      tightnessTestLogs: {
        orderBy: { fechaRealizacion: "desc" },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
      internalVisualInspectionLogs: {
        orderBy: { fechaRealizacion: "desc" },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
      hydrostaticTestLogs: {
        orderBy: { fechaRealizacion: "desc" },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
      extinguisherChangeLogs: {
        orderBy: { fechaRealizacion: "desc" },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
      valveChangeLogs: {
        orderBy: { fechaInstalacion: "desc" },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
      valveCorrectiveMaintenanceLogs: {
        orderBy: { fecha: "desc" },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
      hoseChangeLogs: {
        orderBy: { fechaInstalacion: "desc" },
        include: { documents: { orderBy: { createdAt: "desc" } } },
      },
    },
  });
  if (!vehicle || vehicle.section.city.slug !== params.citySlug) notFound();

  const isAutoTanques = vehicle.section.slug === "auto-tanques";
  const useDeliveryFormat =
    vehicle.section.slug === "vehiculo-de-reparto" ||
    vehicle.section.slug === "vehiculo-con-tanque-de-carburacion";
  const isTanqueCarburacion = vehicle.section.slug === "vehiculo-con-tanque-de-carburacion";
  const showTankSection = vehicle.section.slug !== "vehiculo-de-reparto";
  const showMaintenancePreventiveSection = !isAutoTanques;

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
          {vehicle.section.city.name} · {vehicle.section.name}
        </p>
        <h1 className="text-2xl font-semibold text-primary">{vehicle.numeroEconomico}</h1>
        {!vehicle.activo && (
          <p className="text-sm font-medium text-orange-700">
            Dado de baja{vehicle.fechaBaja ? ` · ${formatDate(vehicle.fechaBaja)}` : ""}
          </p>
        )}
      </div>

      <Section title="Datos generales">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Sucursal" value={vehicle.sucursal} />
          <Field label="Año" value={vehicle.anio} />
          <Field label="Placas" value={vehicle.placas} />
          <Field
            label="Anterior"
            value={[vehicle.numeroAnterior, vehicle.localidadAnterior].filter(Boolean).join(", ") || null}
          />
        </dl>
      </Section>

      <Section title="Ficha técnica">
        <TechnicalSheetView
          sheet={vehicle.technicalSheet}
          useDeliveryFormat={useDeliveryFormat}
          showValveSection={isTanqueCarburacion}
          showHoseSection={isTanqueCarburacion}
          showTankSection={showTankSection}
          showMaintenancePreventiveSection={showMaintenancePreventiveSection}
        />
      </Section>

      <Section title="Bitácora de mantenimiento">
        <LogList
          emptyLabel="Sin mantenimientos registrados."
          entries={vehicle.maintenanceLogs.map((log) => ({
            key: log.id,
            documents: log.documents,
            fields: [
              { label: "Fecha", value: formatDate(log.fecha) },
              { label: "Tipo de mantenimiento", value: log.tipoMantenimiento },
              { label: "Tipo de servicio", value: log.tipoServicio },
              { label: "Kilometraje", value: log.kilometraje != null ? `${log.kilometraje.toLocaleString("es-MX")} km` : null },
              { label: "Pieza", value: log.pieza },
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
          entries={vehicle.extinguisherChangeLogs.map((log) => ({
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
            entries={vehicle.hoseChangeLogs.map((log) => ({
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
            entries={vehicle.valveChangeLogs.map((log) => ({
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
            entries={vehicle.valveCorrectiveMaintenanceLogs.map((log) => ({
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

      {isAutoTanques && (
        <Section title="Inspección Visual Externa">
          <LogList
            emptyLabel="Sin inspecciones visuales externas registradas."
            entries={vehicle.visualInspectionLogs.map((log) => ({
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

      {isAutoTanques && (
        <Section title="Prueba de Hermeticidad">
          <LogList
            emptyLabel="Sin pruebas de hermeticidad registradas."
            entries={vehicle.tightnessTestLogs.map((log) => ({
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

      {isAutoTanques && (
        <Section title="Inspección Visual Interna">
          <LogList
            emptyLabel="Sin inspecciones visuales internas registradas."
            entries={vehicle.internalVisualInspectionLogs.map((log) => ({
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

      {isAutoTanques && (
        <Section title="Registro de ultrasonido">
          <LogList
            emptyLabel="Sin ultrasonidos registrados."
            entries={vehicle.ultrasoundLogs.map((log) => ({
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

      {isAutoTanques && (
        <Section title="Prueba Hidrostática">
          <LogList
            emptyLabel="Sin pruebas hidrostáticas registradas."
            entries={vehicle.hydrostaticTestLogs.map((log) => ({
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

      <Section title="Documentos (PDF)">
        <DocumentList documents={vehicle.documents} isAdmin={false} />
      </Section>
    </div>
  );
}
