import { prisma } from "@/lib/prisma";
import { CreateCityForm } from "@/components/admin/CreateCityForm";
import { CityTable } from "@/components/admin/CityTable";

export default async function CiudadesAdminPage() {
  const cities = await prisma.city.findMany({ orderBy: { order: "asc" } });

  return (
    <div className="space-y-6">
      <CreateCityForm />
      <CityTable cities={cities} />
    </div>
  );
}
