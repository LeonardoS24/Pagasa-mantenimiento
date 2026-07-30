import type { City } from "@prisma/client";
import { assignUserCitiesAction } from "@/actions/user-actions";

export function CityAccessCheckboxes({
  userId,
  cities,
  assignedCityIds,
}: {
  userId: string;
  cities: City[];
  assignedCityIds: Set<string>;
}) {
  return (
    <form action={assignUserCitiesAction.bind(null, userId)} className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {cities.map((city) => (
          <label key={city.id} className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="cityIds"
              value={city.id}
              defaultChecked={assignedCityIds.has(city.id)}
              className="rounded border-gray-300 text-primary focus:ring-accent"
            />
            {city.name}
          </label>
        ))}
      </div>

      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-dark"
      >
        Guardar ciudades asignadas
      </button>
    </form>
  );
}
