import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { resolveSectionPath } from "@/lib/section-path";
import { Breadcrumb, type BreadcrumbItem } from "@/components/layout/Breadcrumb";
import { SectionCard } from "@/components/city/SectionCard";

export default async function SectionPage({
  params,
}: {
  params: { citySlug: string; sectionPath: string[] };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };

  await assertCityAccess(user, params.citySlug);
  const { city, chain, children } = await resolveSectionPath(params.citySlug, params.sectionPath);

  const current = chain[chain.length - 1];

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

      <h1 className="mb-6 text-2xl font-semibold text-primary">{current.name}</h1>

      {children.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {children.map((section) => (
            <SectionCard
              key={section.id}
              name={section.name}
              href={`/ciudades/${city.slug}/${[...params.sectionPath, section.slug].join("/")}`}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-ink">
          <p className="text-lg font-medium text-primary">Próximamente</p>
          <p className="mt-1 text-sm">Este apartado aún no tiene contenido disponible.</p>
        </div>
      )}
    </div>
  );
}
