import { getSession } from "@/lib/auth";
import { getAccessibleCities } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { CityCard } from "@/components/city/CityCard";
import { UltrasoundAlertsPanel } from "@/components/dashboard/UltrasoundAlertsPanel";
import { getUltrasoundAlertLevel, daysUntil } from "@/lib/ultrasound-alerts";

export default async function DashboardPage() {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const cities = await getAccessibleCities(user);

  const upcomingRecords = await prisma.vehicleRecord.findMany({
    where: {
      activo: true,
      section: { cityId: { in: cities.map((city) => city.id) } },
      technicalSheet: {
        fechaProximoUltrasonido: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
    },
    include: { technicalSheet: true, section: { include: { city: true } } },
  });

  const alertVehicles = upcomingRecords
    .map((record) => {
      const fecha = record.technicalSheet?.fechaProximoUltrasonido;
      if (!fecha) return null;
      const level = getUltrasoundAlertLevel(fecha);
      if (level === "none") return null;
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        fechaProximoUltrasonido: fecha,
        level,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => daysUntil(a.fechaProximoUltrasonido) - daysUntil(b.fechaProximoUltrasonido));

  return (
    <div>
      <UltrasoundAlertsPanel vehicles={alertVehicles} />
      <h1 className="mb-1 text-2xl font-semibold text-primary">Ciudades</h1>
      <p className="mb-6 text-sm text-ink">
        {cities.length > 0
          ? "Selecciona una ciudad para ver sus apartados."
          : "Aún no tienes ciudades asignadas. Contacta a un administrador."}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cities.map((city) => (
          <CityCard key={city.id} city={city} />
        ))}
      </div>
    </div>
  );
}
