import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { getSectionChain, sectionBasePath } from "@/lib/section-path";
import { canEdit } from "@/lib/roles";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { DocumentList } from "@/components/city/DocumentList";
import { UploadVehicleDocumentForm } from "@/components/admin/UploadVehicleDocumentForm";
import { VehicleForm } from "@/components/admin/VehicleForm";
import { TechnicalSheetForm } from "@/components/admin/TechnicalSheetForm";
import { TechnicalSheetView } from "@/components/city/TechnicalSheetView";
import { CreateMaintenanceLogForm } from "@/components/admin/CreateMaintenanceLogForm";
import { MaintenanceLogTable } from "@/components/city/MaintenanceLogTable";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { updateVehicleRecord, deleteVehicleRecord, setVehicleActive } from "@/actions/vehicle-actions";
import { formatDate } from "@/lib/dates";
import {
  getUltrasoundAlertLevel,
  ultrasoundAlertBadgeStyles,
  ultrasoundAlertLabel,
} from "@/lib/ultrasound-alerts";

export default async function VehicleDetailPage({
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
    },
  });
  if (!vehicle || vehicle.section.city.slug !== params.citySlug) notFound();

  const chain = await getSectionChain(vehicle.sectionId);
  const basePath = sectionBasePath(params.citySlug, chain);
  const isAdmin = user.role === "ADMIN";
  const isEditor = canEdit(user.role);
  const alertLevel = vehicle.activo
    ? getUltrasoundAlertLevel(vehicle.technicalSheet?.fechaProximoUltrasonido)
    : "none";

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Inicio", href: "/dashboard" },
    { label: vehicle.section.city.name, href: `/ciudades/${params.citySlug}` },
    ...chain.map((section, index) => ({
      label: section.name,
      href: `/ciudades/${params.citySlug}/${chain
        .slice(0, index + 1)
        .map((s) => s.slug)
        .join("/")}`,
    })),
    { label: vehicle.numeroEconomico },
  ];

  return (
    <div>
      <Breadcrumb items={breadcrumbItems} />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-primary">{vehicle.numeroEconomico}</h1>
        {!vehicle.activo && (
          <span className="rounded-full border border-orange-400 bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
            Dado de baja{vehicle.fechaBaja ? ` · ${formatDate(vehicle.fechaBaja)}` : ""}
          </span>
        )}
        {alertLevel !== "none" && vehicle.technicalSheet?.fechaProximoUltrasonido && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${ultrasoundAlertBadgeStyles[alertLevel]}`}
          >
            {ultrasoundAlertLabel(alertLevel, vehicle.technicalSheet.fechaProximoUltrasonido)}
          </span>
        )}
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
        {isEditor ? (
          <VehicleForm
            action={updateVehicleRecord.bind(null, vehicle.id)}
            defaults={vehicle}
            submitLabel="Guardar cambios"
          />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Sucursal
              </dt>
              <dd className="text-ink">{vehicle.sucursal}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Año</dt>
              <dd className="text-ink">{vehicle.anio}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Placas
              </dt>
              <dd className="text-ink">{vehicle.placas}</dd>
            </div>
            {(vehicle.numeroAnterior || vehicle.localidadAnterior) && (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Anterior
                </dt>
                <dd className="text-ink">
                  {[vehicle.numeroAnterior, vehicle.localidadAnterior].filter(Boolean).join(", ")}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Ficha técnica
        </h2>
        {isEditor ? (
          <TechnicalSheetForm vehicleId={vehicle.id} sheet={vehicle.technicalSheet} />
        ) : (
          <TechnicalSheetView sheet={vehicle.technicalSheet} />
        )}
      </div>

      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Bitácora de mantenimiento
        </h2>
        <div className="space-y-3">
          {isEditor && <CreateMaintenanceLogForm vehicleId={vehicle.id} />}
          <MaintenanceLogTable logs={vehicle.maintenanceLogs} canEdit={isEditor} isAdmin={isAdmin} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Documentos (PDF)
        </h2>
        <div className="space-y-3">
          {isEditor && <UploadVehicleDocumentForm vehicleRecordId={vehicle.id} />}
          <DocumentList documents={vehicle.documents} isAdmin={isAdmin} />
        </div>
      </div>

      {isAdmin && (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Estatus de la unidad
          </h2>
          {vehicle.activo ? (
            <form action={setVehicleActive.bind(null, vehicle.id, false)}>
              <ConfirmSubmitButton
                confirmMessage={`¿Dar de baja el número económico "${vehicle.numeroEconomico}"? Seguirá apareciendo en el sistema marcado como dado de baja.`}
                confirmLabel="Sí, dar de baja"
                pendingLabel="Guardando..."
                className="rounded-md border border-orange-500 bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600"
              >
                Dar de baja
              </ConfirmSubmitButton>
            </form>
          ) : (
            <form action={setVehicleActive.bind(null, vehicle.id, true)}>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
              >
                Reactivar unidad
              </button>
            </form>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="mt-8 rounded-lg border border-red-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
            Zona de peligro
          </h2>
          <form action={deleteVehicleRecord.bind(null, vehicle.id)}>
            <ConfirmSubmitButton
              confirmMessage={`¿Eliminar el número económico "${vehicle.numeroEconomico}"? También se eliminarán sus documentos.`}
              className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
            >
              Eliminar número económico
            </ConfirmSubmitButton>
          </form>
        </div>
      )}

      <p className="mt-6 text-sm">
        <Link href={basePath} className="text-primary hover:underline">
          ← Volver a la lista
        </Link>
      </p>
    </div>
  );
}
