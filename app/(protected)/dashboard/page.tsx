import { getSession } from "@/lib/auth";
import { getAccessibleCities } from "@/lib/access";
import { CityCard } from "@/components/city/CityCard";
import { getAllVehicleAlerts } from "@/lib/vehicle-alerts-summary";
import { PanelesDeAlertas } from "@/components/dashboard/PanelesDeAlertas";
import { AvisoCopiaExterna } from "@/components/dashboard/AvisoCopiaExterna";
import { AvisoNormasPorVencer } from "@/components/dashboard/AvisoNormasPorVencer";

export default async function DashboardPage() {
  const session = await getSession();
  const user = { userId: session.userId!, username: session.username!, role: session.role! };
  const cities = await getAccessibleCities(user);

  const alertas = await getAllVehicleAlerts(cities.map((city) => city.id));

  return (
    <div>
      {user.role === "ADMIN" && <AvisoCopiaExterna />}
      {user.role === "ADMIN" && <AvisoNormasPorVencer />}
      <PanelesDeAlertas alertas={alertas} />

      <form action="/buscar" method="GET" className="mb-8">
        <input
          type="search"
          name="q"
          placeholder="Buscar número económico, placas, sucursal..."
          className="w-full rounded-lg border border-gray-300 bg-white px-5 py-4 text-lg text-ink shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </form>

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
