import Link from "next/link";
import type { City } from "@prisma/client";
import { deleteCity } from "@/actions/city-actions";
import { ConfirmSubmitButton } from "./ConfirmSubmitButton";

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
                <form action={deleteCity.bind(null, city.id)}>
                  <ConfirmSubmitButton
                    confirmMessage={`¿Eliminar la ciudad "${city.name}"? Se eliminarán todos sus apartados y accesos asignados.`}
                    className="text-sm text-accent hover:underline"
                  >
                    Eliminar
                  </ConfirmSubmitButton>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
