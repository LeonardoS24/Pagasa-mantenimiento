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
import { CreateValveChangeLogForm } from "@/components/admin/CreateValveChangeLogForm";
import { ValveChangeLogTable } from "@/components/city/ValveChangeLogTable";
import { CreateValveCorrectiveMaintenanceLogForm } from "@/components/admin/CreateValveCorrectiveMaintenanceLogForm";
import { ValveCorrectiveMaintenanceLogTable } from "@/components/city/ValveCorrectiveMaintenanceLogTable";
import { CreateHoseChangeLogForm } from "@/components/admin/CreateHoseChangeLogForm";
import { HoseChangeLogTable } from "@/components/city/HoseChangeLogTable";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { ConfirmDeleteWithPassword } from "@/components/admin/ConfirmDeleteWithPassword";
import {
  updateVehicleRecord,
  deleteVehicleRecord,
  setVehicleActive,
  previewVehicleDeleteImpact,
} from "@/actions/vehicle-actions";
import { formatDate, toDateInputValue } from "@/lib/dates";
import { SECTION_STYLES } from "@/lib/section-colors";
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
import {
  getMaintenanceAlertLevel,
  maintenanceAlertBadgeStyles,
  maintenanceAlertLabel,
} from "@/lib/maintenance-alerts";
import { getValveAlertLevel, getValveVencimiento, valveAlertBadgeStyles, valveAlertLabel } from "@/lib/valve-alerts";
import { getHoseAlertLevel, getHoseVencimiento, hoseAlertBadgeStyles, hoseAlertLabel } from "@/lib/hose-alerts";
import { isAlertVisibleForSection } from "@/lib/alert-visibility";

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

  const chain = await getSectionChain(vehicle.sectionId);
  const basePath = sectionBasePath(params.citySlug, chain);
  const isAdmin = user.role === "ADMIN";
  const isEditor = canEdit(user.role);
  const isAutoTanques = vehicle.section.slug === "auto-tanques";
  const useDeliveryFormat =
    vehicle.section.slug === "vehiculo-de-reparto" ||
    vehicle.section.slug === "vehiculo-con-tanque-de-carburacion";
  const isTanqueCarburacion = vehicle.section.slug === "vehiculo-con-tanque-de-carburacion";
  const showTankSection = vehicle.section.slug !== "vehiculo-de-reparto";
  // Las 5 pruebas de tanque (Visual Externa, Hermeticidad, Visual Interna,
  // Ultrasonido, Hidrostática) viven en Auto-Tanques y en Vehículo con
  // tanque de carburación; Vehículo de reparto no tiene tanque, así que
  // tampoco le corresponden.
  const showInspeccionesSection = isAutoTanques || isTanqueCarburacion;
  const showMaintenancePreventiveSection = !isAutoTanques;
  // Algunas unidades de Auto-Tanques repiten el mismo número económico en
  // Vehículo con tanque de carburación (mismo camión, pero su motor también
  // usa el sistema dual de combustible). Cuando eso pasa, el combustible se
  // fija en Gas LP/Gasolina en ambos registros, no solo en el de tanque de
  // carburación (ver también actions/vehicle-actions.ts).
  const hasTanqueCarburacionMatch =
    isAutoTanques &&
    (await prisma.vehicleRecord.count({
      where: {
        numeroEconomico: vehicle.numeroEconomico,
        id: { not: vehicle.id },
        section: { cityId: vehicle.section.cityId, slug: "vehiculo-con-tanque-de-carburacion" },
      },
    })) > 0;
  const lockCombustibleGasLpGasolina = isTanqueCarburacion || hasTanqueCarburacionMatch;
  const alertLevel = vehicle.activo && isAlertVisibleForSection("ultrasonido", vehicle.section.slug)
    ? getUltrasoundAlertLevel(vehicle.technicalSheet?.fechaProximoUltrasonido)
    : "none";
  const visualAlertLevel = vehicle.activo && isAlertVisibleForSection("visualExterna", vehicle.section.slug)
    ? getVisualInspectionAlertLevel(vehicle.technicalSheet?.fechaProximaInspeccionVisual)
    : "none";
  const tightnessAlertLevel = vehicle.activo && isAlertVisibleForSection("hermeticidad", vehicle.section.slug)
    ? getTightnessTestAlertLevel(vehicle.technicalSheet?.fechaProximaPruebaHermeticidad)
    : "none";
  const internalVisualAlertLevel =
    vehicle.activo && isAlertVisibleForSection("visualInterna", vehicle.section.slug)
      ? getInternalVisualInspectionAlertLevel(vehicle.technicalSheet?.fechaProximaInspeccionVisualInterna)
      : "none";
  const hydrostaticAlertLevel =
    vehicle.activo && isAlertVisibleForSection("hidrostatica", vehicle.section.slug)
      ? getHydrostaticTestAlertLevel(vehicle.technicalSheet?.fechaProximaPruebaHidrostatica)
      : "none";
  const extinguisherAlertLevel =
    vehicle.activo && isAlertVisibleForSection("extintor", vehicle.section.slug)
      ? getExtinguisherAlertLevel(
          vehicle.technicalSheet?.calidadExtintor,
          vehicle.technicalSheet?.fechaCalidadMalaExtintor
        )
      : "none";
  const maintenanceAlertLevel =
    vehicle.activo && isAlertVisibleForSection("mantenimiento", vehicle.section.slug)
      ? getMaintenanceAlertLevel(vehicle.technicalSheet?.fechaProximoMantenimiento)
      : "none";
  const valveDates = {
    fechaFabricacionValvulaLlenado: vehicle.technicalSheet?.fechaFabricacionValvulaLlenado,
    fechaFabricacionValvulaServicio: vehicle.technicalSheet?.fechaFabricacionValvulaServicio,
    fechaFabricacionValvulaMaximoLlenado: vehicle.technicalSheet?.fechaFabricacionValvulaMaximoLlenado,
    fechaFabricacionValvulaAlivio: vehicle.technicalSheet?.fechaFabricacionValvulaAlivio,
  };
  const valveAlertLevel =
    vehicle.activo && isAlertVisibleForSection("valvulas", vehicle.section.slug)
      ? getValveAlertLevel(valveDates)
      : "none";
  const valveVencimiento = getValveVencimiento(valveDates);
  const hoseAlertLevel = vehicle.activo && isAlertVisibleForSection("mangueras", vehicle.section.slug)
    ? getHoseAlertLevel(vehicle.technicalSheet?.fechaFabricacionManguera)
    : "none";
  const hoseVencimiento = getHoseVencimiento(vehicle.technicalSheet?.fechaFabricacionManguera);

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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
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
        {maintenanceAlertLevel !== "none" && vehicle.technicalSheet?.fechaProximoMantenimiento && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${maintenanceAlertBadgeStyles[maintenanceAlertLevel]}`}
          >
            {maintenanceAlertLabel(
              maintenanceAlertLevel,
              vehicle.technicalSheet.fechaProximoMantenimiento,
              vehicle.technicalSheet.kilometrajeProximoMantenimiento
            )}
          </span>
        )}
        {valveAlertLevel !== "none" && valveVencimiento && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${valveAlertBadgeStyles[valveAlertLevel]}`}
          >
            {valveAlertLabel(valveAlertLevel, valveVencimiento)}
          </span>
        )}
        {hoseAlertLevel !== "none" && hoseVencimiento && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${hoseAlertBadgeStyles[hoseAlertLevel]}`}
          >
            {hoseAlertLabel(hoseAlertLevel, hoseVencimiento)}
          </span>
        )}
        </div>
        <Link
          href={`/ciudades/${params.citySlug}/vehiculo/${vehicle.id}/imprimir`}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-gray-50"
        >
          Imprimir hoja completa
        </Link>
      </div>

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
        {/* Datos generales (número económico, sucursal, año, placas) solo los
            edita ADMIN. USUARIO conserva permiso de editar el resto (ficha
            técnica ya era ADMIN-only; bitácoras y documentos siguen abiertos
            a USUARIO vía isEditor más abajo). */}
        {isAdmin ? (
          <VehicleForm
            action={updateVehicleRecord.bind(null, vehicle.id)}
            defaults={vehicle}
            submitLabel="Guardar cambios"
          />
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">
                Sucursal
              </dt>
              <dd className="text-ink">{vehicle.sucursal}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">Año</dt>
              <dd className="text-ink">{vehicle.anio}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase text-gray-500">
                Placas
              </dt>
              <dd className="text-ink">{vehicle.placas}</dd>
            </div>
            {(vehicle.numeroAnterior || vehicle.localidadAnterior) && (
              <div>
                <dt className="text-xs font-semibold uppercase text-gray-500">
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
        <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
          Ficha técnica
        </h2>
        {isAdmin ? (
          <TechnicalSheetForm
            vehicleId={vehicle.id}
            sheet={vehicle.technicalSheet}
            sectionSlug={vehicle.section.slug}
            requireProximoUltrasonido={isAutoTanques}
            requireProximaInspeccionVisual={isAutoTanques}
            requireProximaPruebaHermeticidad={isAutoTanques}
            useDeliveryFormat={useDeliveryFormat}
            showValveSection={isTanqueCarburacion}
            showHoseSection={isTanqueCarburacion}
            showTankSection={showTankSection}
            showInspeccionesSection={showInspeccionesSection}
            showMaintenancePreventiveSection={showMaintenancePreventiveSection}
            lockCombustibleGasLpGasolina={lockCombustibleGasLpGasolina}
          />
        ) : (
          <TechnicalSheetView
            sheet={vehicle.technicalSheet}
            sectionSlug={vehicle.section.slug}
            useDeliveryFormat={useDeliveryFormat}
            showValveSection={isTanqueCarburacion}
            showHoseSection={isTanqueCarburacion}
            showTankSection={showTankSection}
            showInspeccionesSection={showInspeccionesSection}
            showMaintenancePreventiveSection={showMaintenancePreventiveSection}
          />
        )}
      </div>

      {/*
        Orden de los apartados de registro (mismo orden que la ficha
        técnica): Bitácora de mantenimiento, Cambio de extintor, Cambio de
        mangueras/Cambio de válvulas/Mantenimiento correctivo (solo Vehículo
        con tanque de carburación), Inspección Visual Externa, Prueba de
        Hermeticidad, Inspección Visual Interna, Ultrasonido y Prueba
        Hidrostática (solo Auto-Tanques).
      */}
      <div id="mantenimiento" className={`mb-8 rounded-lg p-5 ${SECTION_STYLES.mantenimiento}`}>
        <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
          Bitácora de mantenimiento
        </h2>
        <div className="space-y-3">
          {isEditor && <CreateMaintenanceLogForm vehicleId={vehicle.id} />}
          <MaintenanceLogTable logs={vehicle.maintenanceLogs} canEdit={isEditor} isAdmin={isAdmin} />
        </div>
      </div>

      <div className={`mb-8 rounded-lg p-5 ${SECTION_STYLES.extintor}`}>
        <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
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

      {isTanqueCarburacion && (
        <div className={`mb-8 rounded-lg p-5 ${SECTION_STYLES.mangueras}`}>
          <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
            Cambio de mangueras
          </h2>
          <div className="space-y-3">
            {isEditor && <CreateHoseChangeLogForm vehicleId={vehicle.id} />}
            <HoseChangeLogTable logs={vehicle.hoseChangeLogs} canEdit={isEditor} isAdmin={isAdmin} />
          </div>
        </div>
      )}

      {isTanqueCarburacion && (
        <div id="valvulas" className={`mb-8 rounded-lg p-5 ${SECTION_STYLES.valvulas}`}>
          <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
            Cambio de válvulas
          </h2>
          <div className="space-y-3">
            {isEditor && <CreateValveChangeLogForm vehicleId={vehicle.id} />}
            <ValveChangeLogTable logs={vehicle.valveChangeLogs} canEdit={isEditor} isAdmin={isAdmin} />
          </div>
        </div>
      )}

      {isTanqueCarburacion && (
        <div id="valvulas-correctivo" className={`mb-8 rounded-lg p-5 ${SECTION_STYLES.valvulas}`}>
          <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
            Mantenimiento correctivo de válvulas
          </h2>
          <div className="space-y-3">
            {isEditor && <CreateValveCorrectiveMaintenanceLogForm vehicleId={vehicle.id} />}
            <ValveCorrectiveMaintenanceLogTable
              logs={vehicle.valveCorrectiveMaintenanceLogs}
              canEdit={isEditor}
              isAdmin={isAdmin}
            />
          </div>
        </div>
      )}

      {showInspeccionesSection && (
        <div className={`mb-8 rounded-lg p-5 ${SECTION_STYLES.visualExterna}`}>
          <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
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

      {showInspeccionesSection && (
        <div className={`mb-8 rounded-lg p-5 ${SECTION_STYLES.hermeticidad}`}>
          <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
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

      {showInspeccionesSection && (
        <div className={`mb-8 rounded-lg p-5 ${SECTION_STYLES.visualInterna}`}>
          <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
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

      {showInspeccionesSection && (
        <div className={`mb-8 rounded-lg p-5 ${SECTION_STYLES.ultrasonido}`}>
          <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
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

      {showInspeccionesSection && (
        <div className={`mb-8 rounded-lg p-5 ${SECTION_STYLES.hidrostatica}`}>
          <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
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
        <h2 className="mb-4 text-sm font-semibold uppercase text-primary-bright">
          Documentos (PDF o imagen)
        </h2>
        <div className="space-y-3">
          {isEditor && <UploadVehicleDocumentForm vehicleRecordId={vehicle.id} />}
          <DocumentList documents={vehicle.documents} isAdmin={isAdmin} />
        </div>
      </div>

      {isAdmin && (
        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
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
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark"
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
          <ConfirmDeleteWithPassword
            nombre={vehicle.numeroEconomico}
            tipo="unidad"
            action={deleteVehicleRecord.bind(null, vehicle.id)}
            cargarImpacto={previewVehicleDeleteImpact.bind(null, vehicle.id)}
            className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
          >
            Eliminar unidad
          </ConfirmDeleteWithPassword>
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
