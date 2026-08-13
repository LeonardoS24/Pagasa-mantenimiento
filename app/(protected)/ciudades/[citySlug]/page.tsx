import { getSession } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { resolveSectionPath } from "@/lib/section-path";
import { isAggregateCitySlug } from "@/lib/aggregate-city";
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

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="3" width="9" height="18" />
              <rect x="14" y="8" width="6" height="13" />
              <path d="M7 7h3M7 11h3M7 15h3M16.5 11.5h1M16.5 15h1" />
            </svg>
          </span>
          <h1 className="text-2xl font-semibold text-primary">{city.name}</h1>
        </div>
        {!isAggregateCitySlug(city.slug) && (
          <a
            href={`/api/ciudades/${city.slug}/excel`}
            className="inline-flex items-center gap-2 rounded-md border border-primary/30 bg-white px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/5"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0-4-4m4 4 4-4" />
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Descargar Excel
          </a>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {children.map((section) => (
          <SectionCard
            key={section.id}
            name={section.name}
            slug={section.slug}
            href={`/ciudades/${city.slug}/${section.slug}`}
          />
        ))}
      </div>
    </div>
  );
}
