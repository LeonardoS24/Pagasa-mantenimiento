import Link from "next/link";
import type { City } from "@prisma/client";
import { deleteCity, previewCityDeleteImpact } from "@/actions/city-actions";
import { ConfirmDeleteWithPassword } from "./ConfirmDeleteWithPassword";

export function CityTable({ cities }: { cities: City[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2">Ciudad</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {cities.map((city) => (
            <tr key={city.id} className="relative border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2">
                {/* Estira el link a toda la fila (no solo el nombre): "tr" es
                    "relative" y este link "absolute inset-0" toma su tamaño
                    completo. El link visible de abajo sigue ahí para que el
                    texto se vea subrayado/enfocable como antes. */}
                <Link href={`/admin/ciudades/${city.id}`} className="absolute inset-0" aria-label={city.name} />
                <Link href={`/admin/ciudades/${city.id}`} className="relative text-primary hover:underline" tabIndex={-1}>
                  {city.name}
                </Link>
              </td>
              <td className="relative px-4 py-2 text-right">
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
