import Link from "next/link";
import type { City } from "@prisma/client";
import { deleteCity, previewCityDeleteImpact } from "@/actions/city-actions";
import { ConfirmDeleteWithPassword } from "./ConfirmDeleteWithPassword";

export function CityTable({ cities }: { cities: City[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-2">Ciudad</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {cities.map((city) => (
            <tr key={city.id} className="border-t border-gray-100">
              <td className="px-4 py-2">
                <Link href={`/admin/ciudades/${city.id}`} className="text-primary hover:underline">
                  {city.name}
                </Link>
              </td>
              <td className="px-4 py-2 text-right">
                <div className="flex justify-end">
                  <ConfirmDeleteWithPassword
                    key={city.id}
                    nombre={city.name}
                    tipo="ciudad"
                    action={deleteCity.bind(null, city.id)}
                    cargarImpacto={previewCityDeleteImpact.bind(null, city.id)}
                    className="text-sm text-accent hover:underline"
                  >
                    Eliminar
                  </ConfirmDeleteWithPassword>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
