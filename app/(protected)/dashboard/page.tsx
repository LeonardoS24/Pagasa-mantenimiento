import { getSession } from "@/lib/auth";
import { getAccessibleCities } from "@/lib/access";
import { CityCard } from "@/components/city/CityCard";

export default async function DashboardPage() {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const cities = await getAccessibleCities(user);

  return (
    <div>
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
