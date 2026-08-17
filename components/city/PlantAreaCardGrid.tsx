import Link from "next/link";
import { PLANT_AREAS } from "@/lib/plant-areas";

export function PlantAreaCardGrid({ citySlug }: { citySlug: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {PLANT_AREAS.map((area) => (
        <Link
          key={area.clave}
          href={`/ciudades/${citySlug}/area-planta/${area.clave}`}
          className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gray-100 text-sm font-semibold text-gray-500">
            {area.clave}
          </span>
          <h3 className="font-medium text-primary">{area.nombre}</h3>
        </Link>
      ))}
    </div>
  );
}
