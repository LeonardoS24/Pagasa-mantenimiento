import Link from "next/link";
import type { City } from "@prisma/client";
import { getCityInfo } from "@/lib/city-info";

export function CityCard({ city }: { city: City }) {
  const info = getCityInfo(city.slug);
  return (
    <Link
      href={`/ciudades/${city.slug}`}
      className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
    >
      <span
        className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${info.badge}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-light">Sede</p>
        <h2 className="mt-1 text-lg font-semibold text-primary">{city.name}</h2>
        {info.estado && <p className="text-xs text-gray-500">{info.estado}</p>}
      </div>
    </Link>
  );
}
