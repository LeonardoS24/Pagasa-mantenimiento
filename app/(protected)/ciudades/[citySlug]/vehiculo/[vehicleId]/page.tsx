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
import { CreateUltrasoundLogForm } from "@/components/admin/CreateUltrasoundLogForm";
import { UltrasoundLogTable } from "@/components/city/UltrasoundLogTable";
import { CreateVisualInspectionLogForm } from "@/components/admin/CreateVisualInspectionLogForm";
import { VisualInspectionLogTable } from "@/components/city/VisualInspectionLogTable";
import { CreateTightnessTestLogForm } from "@/components/admin/CreateTightnessTestLogForm";
import { TightnessTestLogTable } from "@/components/city/TightnessTestLogTable";
import { CreateInternalVisualInspectionLogForm } from "@/components/admin/CreateInternalVisualInspectionLogForm";
import { InternalVisualInspectionLogTable } from "@/components/city/InternalVisualInspectionLogTable";
import { CreateHydrostaticTestLogForm } from "@/components/admin/CreateHydrostaticTestLogForm";
import { HydrostaticTestLogTable } from "@/components/city/HydrostaticTestLogTable";
import { CreateExtinguisherChangeLogForm } from "@/components/admin/CreateExtinguisherChangeLogForm";
import { ExtinguisherChangeLogTable } from "@/components/city/ExtinguisherChangeLogTable";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { updateVehicleRecord, deleteVehicleRecord, setVehicleActive } from "@/actions/vehicle-actions";
import { formatDate, toDateInputValue } from "@/lib/dates";
import {
  getUltrasoundAlertLevel,
  ultrasoundAlertBadgeStyles,
  ultrasoundAlertLabel,
} from "@/lib/ultrasound-alerts";
import {
  getVisualInspectionAlertLevel,
  visualInspectionAlertBadgeStyles,
  visualInspectionAlertLabel,
} from "@/lib/visual-inspection-alerts";
import {
  getTightnessTestAlertLevel,
  tightnessTestAlertBadgeStyles,
  tightnessTestAlertLabel,
} from "@/lib/tightness-test-alerts";
import {
  getInternalVisualInspectionAlertLevel,
  internalVisualInspectionAlertBadgeStyles,
  internalVisualInspectionAlertLabel,
} from "@/lib/internal-visual-inspection-alerts";
import {
  getHydrostaticTestAlertLevel,
  hydrostaticTestAlertBadgeStyles,
  hydrostaticTestAlertLabel,
} from "@/lib/hydrostatic-test-alerts";
import {
  getExtinguisherAlertLevel,
  extinguisherAlertBadgeStyles,
  extinguisherAlertLabel,
} from "@/lib/extinguisher-alerts";

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
    },
  });
  if (!vehicle || vehicle.section.city.slug !== params.citySlug) notFound();

  const chain = await getSectionChain(vehicle.sectionId);
  const basePath = sectionBasePath(params.citySlug, chain);
  const isAdmin = user.role === "ADMIN";
  const isEditor = canEdit(user.role);
  const isAutoTanques = vehicle.section.slug === "auto-tanques";
  const useDeliveryFormat =
    vehicle.section.slug === "vehiculo-de-reparto" ||
    vehicle.section.slug === "vehiculo-con-tanque-de-carburacion";
  const alertLevel = vehicle.activo
    ? getUltrasoundAlertLevel(vehicle.technicalSheet?.fechaProximoUltrasonido)
    : "none";
  const visualAlertLevel = vehicle.activo
    ? getVisualInspectionAlertLevel(vehicle.technicalSheet?.fechaProximaInspeccionVisual)
    : "none";
  const tightnessAlertLevel = vehicle.activo
    ? getTightnessTestAlertLevel(vehicle.technicalSheet?.fechaProximaPruebaHermeticidad)
    : "none";
  const internalVisualAlertLevel = vehicle.activo
    ? getInternalVisualInspectionAlertLevel(vehicle.technicalSheet?.fechaProximaInspeccionVisualInterna)
    : "none";
  const hydrostaticAlertLevel = vehicle.activo
    ? getHydrostaticTestAlertLevel(vehicle.technicalSheet?.fechaProximaPruebaHidrostatica)
    : "none";
  const extinguisherAlertLevel = vehicle.activo
    ? getExtinguisherAlertLevel(
        vehicle.technicalSheet?.calidadExtintor,
        vehicle.technicalSheet?.fechaCalidadMalaExtintor
      )
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
        {visualAlertLevel !== "none" && vehicle.technicalSheet?.fechaProximaInspeccionVisual && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${visualInspectionAlertBadgeStyles[visualAlertLevel]}`}
          >
            {visualInspectionAlertLabel(
              visualAlertLevel,
              vehicle.technicalSheet.fechaProximaInspeccionVisual
            )}
          </span>
        )}
        {tightnessAlertLevel !== "none" && vehicle.technicalSheet?.fechaProximaPruebaHermeticidad && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${tightnessTestAlertBadgeStyles[tightnessAlertLevel]}`}
          >
            {tightnessTestAlertLabel(
              tightnessAlertLevel,
              vehicle.technicalSheet.fechaProximaPruebaHermeticidad
            )}
          </span>
        )}
        {internalVisualAlertLevel !== "none" &&
          vehicle.technicalSheet?.fechaProximaInspeccionVisualInterna && (
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${internalVisualInspectionAlertBadgeStyles[internalVisualAlertLevel]}`}
            >
              {internalVisualInspectionAlertLabel(
                internalVisualAlertLevel,
                vehicle.technicalSheet.fechaProximaInspeccionVisualInterna
              )}
            </span>
          )}
        {hydrostaticAlertLevel !== "none" && vehicle.technicalSheet?.fechaProximaPruebaHidrostatica && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${hydrostaticTestAlertBadgeStyles[hydrostaticAlertLevel]}`}
          >
            {hydrostaticTestAlertLabel(
              hydrostaticAlertLevel,
              vehicle.technicalSheet.fechaProximaPruebaHidrostatica
            )}
          </span>
        )}
        {extinguisherAlertLevel !== "none" && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${extinguisherAlertBadgeStyles[extinguisherAlertLevel]}`}
          >
            {extinguisherAlertLabel(extinguisherAlertLevel, vehicle.technicalSheet?.fechaCalidadMalaExtintor)}
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
          <TechnicalSheetForm
            vehicleId={vehicle.id}
            sheet={vehicle.technicalSheet}
            requireProximoUltrasonido={isAutoTanques}
            requireProximaInspeccionVisual={isAutoTanques}
            requireProximaPruebaHermeticidad={isAutoTanques}
            useDeliveryFormat={useDeliveryFormat}
          />
        ) : (
          <TechnicalSheetView sheet={vehicle.technicalSheet} useDeliveryFormat={useDeliveryFormat} />
        )}
      </div>

      {isAutoTanques && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Registro de ultrasonido
          </h2>
          <div className="space-y-3">
            {isEditor && (
              <CreateUltrasoundLogForm
                vehicleId={vehicle.id}
                ultimoUltrasonido={toDateInputValue(vehicle.technicalSheet?.ultimoUltrasonido)}
              />
            )}
            <UltrasoundLogTable logs={vehicle.ultrasoundLogs} canEdit={isEditor} isAdmin={isAdmin} />
          </div>
        </div>
      )}

      {isAutoTanques && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Inspección Visual Externa
          </h2>
          <div className="space-y-3">
            {isEditor && (
              <CreateVisualInspectionLogForm
                vehicleId={vehicle.id}
                ultimaInspeccionVisual={toDateInputValue(
                  vehicle.technicalSheet?.ultimaInspeccionVisual
                )}
              />
            )}
            <VisualInspectionLogTable
              logs={vehicle.visualInspectionLogs}
              canEdit={isEditor}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      {isAutoTanques && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Prueba de Hermeticidad
          </h2>
          <div className="space-y-3">
            {isEditor && (
              <CreateTightnessTestLogForm
                vehicleId={vehicle.id}
                ultimaPruebaHermeticidad={toDateInputValue(
                  vehicle.technicalSheet?.ultimaPruebaHermeticidad
                )}
              />
            )}
            <TightnessTestLogTable
              logs={vehicle.tightnessTestLogs}
              canEdit={isEditor}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      {isAutoTanques && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Inspección Visual Interna
          </h2>
          <div className="space-y-3">
            {isEditor && (
              <CreateInternalVisualInspectionLogForm
                vehicleId={vehicle.id}
                ultimaInspeccionVisualInterna={toDateInputValue(
                  vehicle.technicalSheet?.ultimaInspeccionVisualInterna
                )}
              />
            )}
            <InternalVisualInspectionLogTable
              logs={vehicle.internalVisualInspectionLogs}
              canEdit={isEditor}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      {isAutoTanques && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Prueba Hidrostática
          </h2>
          <div className="space-y-3">
            {isEditor && (
              <CreateHydrostaticTestLogForm
                vehicleId={vehicle.id}
                ultimaPruebaHidrostatica={toDateInputValue(
                  vehicle.technicalSheet?.ultimaPruebaHidrostatica
                )}
              />
            )}
            <HydrostaticTestLogTable
              logs={vehicle.hydrostaticTestLogs}
              canEdit={isEditor}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Cambio de extintor
        </h2>
        <div className="space-y-3">
          {isEditor && <CreateExtinguisherChangeLogForm vehicleId={vehicle.id} />}
          <ExtinguisherChangeLogTable
            logs={vehicle.extinguisherChangeLogs}
            canEdit={isEditor}
            isAdmin={isAdmin}
          />
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Bitácora de mantenimiento
        </h2>
        <div className="space-y-3">
          {isEditor && <CreateMaintenanceLogForm vehicleId={vehicle.id} />}
          <MaintenanceLogTable logs={vehicle.maintenanceLogs} canEdit={isEditor} isAdmin={isAdmin} />
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Documentos (PDF)
        </h2>
        <div className="space-y-3">
          {isEditor && <UploadVehicleDocumentForm vehicleRecordId={vehicle.id} />}
          <DocumentList documents={vehicle.documents} isAdmin={isAdmin} />
        </div>
      </div>

      {isAdmin && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
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
        <div className="mb-8 rounded-lg border border-red-200 bg-white p-5">
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
