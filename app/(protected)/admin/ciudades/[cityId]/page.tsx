import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SectionTree } from "@/components/admin/SectionTree";

export default async function CityAdminPage({
  params,
}: {
  params: { cityId: string };
}) {
  const city = await prisma.city.findUnique({ where: { id: params.cityId } });
  if (!city) notFound();

  const sections = await prisma.section.findMany({ where: { cityId: city.id } });

  return (
    <div>
      <Link href="/admin/ciudades" className="text-sm text-primary hover:underline">
        ← Volver a ciudades
      </Link>
      <h2 className="mb-4 mt-2 text-xl font-semibold text-primary">{city.name}</h2>

      <SectionTree cityId={city.id} sections={sections} />
    </div>
  );
}
