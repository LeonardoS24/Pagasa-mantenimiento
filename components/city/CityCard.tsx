import Link from "next/link";
import type { City } from "@prisma/client";
import { getCityInfo } from "@/lib/city-info";
import { isAggregateCitySlug } from "@/lib/aggregate-city";

export function CityCard({ city }: { city: City }) {
  const info = getCityInfo(city.slug);
  // "Administración" no es una sede real (ver lib/aggregate-city.ts): la
  // tarjeta lleva su propio ícono y etiqueta para que no se confunda con una
  // ciudad más de la lista.
  const isAggregate = isAggregateCitySlug(city.slug);
  // Hermosillo es la matriz, no una sede más: etiqueta y color distintos
  // para que resalte sobre el resto de las ciudades reales.
  const isMatriz = city.slug === "hermosillo";

  return (
    <Link
      href={`/ciudades/${city.slug}`}
      className={`flex items-start gap-3 rounded-lg border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
        isAggregate
          ? "border-dashed border-accent/40 hover:border-accent"
          : `border-gray-200 ${info.hoverBorder}`
      }`}
    >
      <span
        className={`mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${info.badge}`}
      >
        {isAggregate ? (
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" />
          </svg>
        ) : (
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
        )}
      </span>
      <div>
        <p
          className={`text-xs font-semibold uppercase tracking-wide ${
            isAggregate ? "text-accent-light" : isMatriz ? "text-green-600" : "text-accent-light"
          }`}
        >
          {isAggregate ? "Control general" : isMatriz ? "Matriz" : "Sede"}
        </p>
        <h2 className="mt-1 text-lg font-semibold text-primary">{city.name}</h2>
        {info.estado && <p className="text-xs text-gray-500">{info.estado}</p>}
      </div>
    </Link>
  );
}
