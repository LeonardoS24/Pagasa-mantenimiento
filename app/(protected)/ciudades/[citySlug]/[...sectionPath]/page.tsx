import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { resolveSectionPath } from "@/lib/section-path";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/roles";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { SectionCard } from "@/components/city/SectionCard";
import { SectionIcon } from "@/components/layout/SectionIcon";
import { VehicleTable } from "@/components/city/VehicleTable";
import { DocumentList } from "@/components/city/DocumentList";
import { UploadDocumentForm } from "@/components/admin/UploadDocumentForm";
import { CreateVehicleForm } from "@/components/admin/CreateVehicleForm";
import { CityMaintenanceFeed } from "@/components/city/CityMaintenanceFeed";
import { getCityUnitLogFeed } from "@/lib/city-unit-log-feed";
import { CreatePieceOrderForm } from "@/components/admin/CreatePieceOrderForm";
import { PieceOrderTable } from "@/components/city/PieceOrderTable";
import { InventoryItemTable } from "@/components/city/InventoryItemTable";
import { sweepExpiredPorUtilizar } from "@/actions/inventory-actions";
import { CreateEquipoForm } from "@/components/admin/CreateEquipoForm";
import { EquipoTable } from "@/components/city/EquipoTable";
import { getCityEquipmentLogFeed } from "@/lib/city-equipment-log-feed";
import { CityEquipmentLogFeed } from "@/components/city/CityEquipmentLogFeed";

export default async function SectionPage({
  params,
}: {
  params: { citySlug: string; sectionPath: string[] };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const isAdmin = user.role === "ADMIN";
  const isEditor = canEdit(user.role);

  await assertCityAccess(user, params.citySlug);
  const { city, chain, children } = await resolveSectionPath(params.citySlug, params.sectionPath);

  const current = chain[chain.length - 1];
  const isBitacoraFeed = chain.length === 1 && current.slug === "bitacoras-de-unidades";
  const isOrdenDePieza = chain.length === 1 && current.slug === "orden-de-pieza";
  const isInventarios = chain.length === 1 && current.slug === "inventarios";
  const isEquiposSection = chain.length === 1 && current.slug === "equipos";
  const isBitacoraEquiposFeed = chain.length === 1 && current.slug === "bitacora-de-equipos";

  // Cualquier apartado hoja directamente dentro de "Unidad de distribución"
  // (en cualquier ciudad) es un apartado de tipo unidades: muestra la tabla
  // de números económicos y el alta de nuevos, aunque todavía esté vacío.
  const isUnderUnidadDistribucion = chain.length >= 2 && chain[0].slug === "unidad-de-distribucion";
  const isVehicleSection = children.length === 0 && !isBitacoraFeed && isUnderUnidadDistribucion;

  // Las unidades dadas de baja se listan aparte, siempre al final: entre
  // ellas se ordenan por fecha de baja (más reciente primero) en vez del
  // orden manual usado para las unidades activas.
  const vehicleRecords = isVehicleSection
    ? await (async () => {
        const [activeRecords, inactiveRecords] = await Promise.all([
          prisma.vehicleRecord.findMany({
            where: { sectionId: current.id, activo: true },
            orderBy: { order: "asc" },
            include: { technicalSheet: true },
          }),
          prisma.vehicleRecord.findMany({
            where: { sectionId: current.id, activo: false },
            orderBy: { fechaBaja: "desc" },
            include: { technicalSheet: true },
          }),
        ]);
        return [...activeRecords, ...inactiveRecords];
      })()
    : [];

  const cityMaintenanceLogs = isBitacoraFeed ? await getCityUnitLogFeed(city.id) : [];
  const cityEquipmentLogs = isBitacoraEquiposFeed ? await getCityEquipmentLogFeed(city.id) : [];

  // Los equipos dados de baja (reemplazados con un mantenimiento tipo
  // "Cambio", ver actions/equipment-log-actions.ts) se listan aparte, igual
  // que las unidades: siempre al final, ordenados por fecha de baja.
  const equipos = isEquiposSection
    ? await (async () => {
        const [activos, inactivos] = await Promise.all([
          prisma.equipo.findMany({ where: { sectionId: current.id, activo: true }, orderBy: { order: "asc" } }),
          prisma.equipo.findMany({
            where: { sectionId: current.id, activo: false },
            orderBy: { fechaBaja: "desc" },
          }),
        ]);
        return [...activos, ...inactivos];
      })()
    : [];

  const pieceOrders = isOrdenDePieza
    ? await prisma.pieceOrder.findMany({
        where: { sectionId: current.id },
        orderBy: { fechaOrden: "desc" },
        include: { vehicleRecord: { select: { id: true, numeroEconomico: true } } },
      })
    : [];

  if (isInventarios) {
    await sweepExpiredPorUtilizar(current.id);
  }
  const inventoryItems = isInventarios
    ? await prisma.inventoryItem.findMany({
        where: { sectionId: current.id },
        orderBy: { fechaIngreso: "desc" },
        include: {
          usedOnVehicle: { select: { id: true, numeroEconomico: true } },
          usedOnMaintenanceLog: { select: { fecha: true, tipoMantenimiento: true } },
          usedOnValveChangeLog: { select: { fechaInstalacion: true } },
          usedOnValveCorrectiveMaintenanceLog: { select: { fecha: true, descripcion: true } },
        },
      })
    : [];

  // Unidades activas de la ciudad: para elegir dónde se colocó una pieza al
  // marcarla "Utilizada" (ver InventoryItemStatusForm) y para elegir la
  // unidad destino al levantar una orden, si ya se sabe (ver
  // CreatePieceOrderForm).
  const cityVehicles = isInventarios || isOrdenDePieza
    ? await prisma.vehicleRecord.findMany({
        where: { activo: true, section: { cityId: city.id } },
        orderBy: [{ section: { order: "asc" } }, { numeroEconomico: "asc" }],
        select: { id: true, numeroEconomico: true, section: { select: { name: true } } },
      })
    : [];

  const documents = isVehicleSection || isEquiposSection
    ? []
    : await prisma.document.findMany({
        where: { sectionId: current.id },
        orderBy: { createdAt: "desc" },
      });

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Inicio", href: "/dashboard" },
    { label: city.name, href: `/ciudades/${city.slug}` },
    ...chain.map((section, index) => {
      const isLast = index === chain.length - 1;
      const href = `/ciudades/${city.slug}/${chain
        .slice(0, index + 1)
        .map((s) => s.slug)
        .join("/")}`;
      return { label: section.name, href: isLast ? undefined : href };
    }),
  ];

  return (
    <div>
      <Breadcrumb items={breadcrumbItems} />

      <div className="mb-6 flex items-center gap-3">
        <SectionIcon slug={current.slug} className="h-11 w-11" />
        <h1 className="text-2xl font-semibold text-primary">{current.name}</h1>
      </div>

      {children.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {children.map((section) => (
            <SectionCard
              key={section.id}
              name={section.name}
              slug={section.slug}
              href={`/ciudades/${city.slug}/${[...params.sectionPath, section.slug].join("/")}`}
            />
          ))}
        </div>
      ) : isBitacoraFeed ? (
        <CityMaintenanceFeed logs={cityMaintenanceLogs} citySlug={city.slug} />
      ) : isBitacoraEquiposFeed ? (
        <CityEquipmentLogFeed logs={cityEquipmentLogs} citySlug={city.slug} />
      ) : isEquiposSection ? (
        <div>
          <EquipoTable equipos={equipos} citySlug={city.slug} />
          {isEditor && <CreateEquipoForm sectionId={current.id} />}
        </div>
      ) : isOrdenDePieza ? (
        <div className="space-y-3">
          {isEditor && <CreatePieceOrderForm sectionId={current.id} vehicles={cityVehicles} />}
          <PieceOrderTable orders={pieceOrders} canEdit={isEditor} isAdmin={isAdmin} citySlug={city.slug} />
        </div>
      ) : isInventarios ? (
        <InventoryItemTable
          items={inventoryItems}
          vehicles={cityVehicles}
          citySlug={city.slug}
          canEdit={isEditor}
          isAdmin={isAdmin}
        />
      ) : isVehicleSection ? (
        <div>
          <VehicleTable records={vehicleRecords} citySlug={city.slug} sectionSlug={current.slug} />
          {isEditor && <CreateVehicleForm sectionId={current.id} />}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-ink">
          <p className="text-lg font-medium text-primary">Próximamente</p>
          <p className="mt-1 text-sm">Este apartado aún no tiene contenido disponible.</p>
        </div>
      )}

      {!isVehicleSection && !isEquiposSection && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
            Documentos (PDF o imagen)
          </h2>
          <div className="space-y-3">
            {isEditor && <UploadDocumentForm sectionId={current.id} />}
            <DocumentList documents={documents} isAdmin={isAdmin} />
          </div>
        </div>
      )}
    </div>
  );
}
