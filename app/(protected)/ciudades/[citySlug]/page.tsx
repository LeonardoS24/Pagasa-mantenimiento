import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { resolveSectionPath } from "@/lib/section-path";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { SectionCard } from "@/components/city/SectionCard";

export default async function CityPage({
  params,
}: {
  params: { citySlug: string };
}) {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };

  await assertCityAccess(user, params.citySlug);
  const { city, children } = await resolveSectionPath(params.citySlug, []);

  return (
    <div>
      <Breadcrumb items={[{ label: "Inicio", href: "/dashboard" }, { label: city.name }]} />

      <h1 className="mb-6 text-2xl font-semibold text-primary">{city.name}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children.map((section) => (
          <SectionCard
            key={section.id}
            name={section.name}
            href={`/ciudades/${city.slug}/${section.slug}`}
          />
        ))}
      </div>
    </div>
  );
}
