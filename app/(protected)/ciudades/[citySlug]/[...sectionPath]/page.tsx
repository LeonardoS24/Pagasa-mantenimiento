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

  // Cualquier apartado hoja directamente dentro de "Unidad de distribución"
  // (en cualquier ciudad) es un apartado de tipo unidades: muestra la tabla
  // de números económicos y el alta de nuevos, aunque todavía esté vacío.
  const isUnderUnidadDistribucion = chain.length >= 2 && chain[0].slug === "unidad-de-distribucion";
  const isVehicleSection = children.length === 0 && !isBitacoraFeed && isUnderUnidadDistribucion;

  const vehicleRecords = isVehicleSection
    ? await prisma.vehicleRecord.findMany({
        where: { sectionId: current.id },
        orderBy: { order: "asc" },
        include: { technicalSheet: true },
      })
    : [];

  const cityMaintenanceLogs = isBitacoraFeed
    ? await prisma.maintenanceLog.findMany({
        where: { vehicleRecord: { section: { cityId: city.id } } },
        orderBy: { fecha: "desc" },
        take: 100,
        include: { vehicleRecord: true },
      })
    : [];

  const documents = isVehicleSection
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
      ) : isVehicleSection ? (
        <div>
          <VehicleTable records={vehicleRecords} citySlug={city.slug} />
          {isEditor && <CreateVehicleForm sectionId={current.id} />}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-ink">
          <p className="text-lg font-medium text-primary">Próximamente</p>
          <p className="mt-1 text-sm">Este apartado aún no tiene contenido disponible.</p>
        </div>
      )}

      {!isVehicleSection && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Documentos (PDF)
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
