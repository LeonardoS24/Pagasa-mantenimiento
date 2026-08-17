import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { canEdit } from "@/lib/roles";
import { hasActiveElevatedAccess } from "@/lib/elevated-access";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { SectionIcon } from "@/components/layout/SectionIcon";
import { isPlantAreaClave, plantAreaNombre } from "@/lib/plant-areas";
import { getPlantAreaChecklistItems } from "@/lib/plant-area-checklist-runtime";
import { CreatePlantAreaMaintenanceLogForm } from "@/components/admin/CreatePlantAreaMaintenanceLogForm";
import { PlantAreaMaintenanceLogTable } from "@/components/city/PlantAreaMaintenanceLogTable";

export default async function PlantAreaPage({
  params,
}: {
  params: { citySlug: string; areaClave: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const isAdmin =
    user.role === "ADMIN" || (user.role === "USUARIO" && (await hasActiveElevatedAccess(user.userId)));
  const isEditor = canEdit(user.role);

  await assertCityAccess(user, params.citySlug);

  const areaClave = params.areaClave.toUpperCase();
  if (!isPlantAreaClave(areaClave)) {
    notFound();
  }

  const section = await prisma.section.findFirst({
    where: { city: { slug: params.citySlug }, slug: "areas-de-planta", parent: { slug: "planta" } },
    include: { city: true, parent: true },
  });
  if (!section) {
    notFound();
  }

  const [logs, checklistItems] = await Promise.all([
    prisma.plantAreaMaintenanceLog.findMany({
      where: { sectionId: section.id, area: areaClave },
      orderBy: { fecha: "desc" },
    }),
    getPlantAreaChecklistItems(areaClave),
  ]);

  const nombre = plantAreaNombre(areaClave);

  const breadcrumbItems: BreadcrumbItem[] = [
    { label: "Inicio", href: "/dashboard" },
    { label: section.city.name, href: `/ciudades/${section.city.slug}` },
    { label: section.parent!.name, href: `/ciudades/${section.city.slug}/planta` },
    { label: section.name, href: `/ciudades/${section.city.slug}/planta/areas-de-planta` },
    { label: nombre },
  ];

  return (
    <div>
      <Breadcrumb items={breadcrumbItems} />

      <div className="mb-6 flex items-center gap-3">
        <SectionIcon slug="areas-de-planta" className="h-11 w-11" />
        <div>
          <span className="text-xs font-semibold uppercase text-gray-500">Área {areaClave}</span>
          <h1 className="text-2xl font-semibold text-primary">{nombre}</h1>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
          Bitácora de mantenimiento
        </h2>
        <div className="space-y-3">
          {isEditor && (
            <CreatePlantAreaMaintenanceLogForm
              sectionId={section.id}
              area={areaClave}
              checklistItems={checklistItems}
            />
          )}
          <PlantAreaMaintenanceLogTable logs={logs} isAdmin={isAdmin} />
        </div>
      </div>
    </div>
  );
}
