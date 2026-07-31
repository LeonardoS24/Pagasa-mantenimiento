import Link from "next/link";
import type { City } from "@prisma/client";

export function CityCard({ city }: { city: City }) {
  return (
    <Link
      href={`/ciudades/${city.slug}`}
      className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-light">Sede</p>
      <h2 className="mt-1 text-lg font-semibold text-primary">{city.name}</h2>
    </Link>
  );
}
