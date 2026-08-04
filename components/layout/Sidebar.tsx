"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { City } from "@prisma/client";

function CityDot() {
  return <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />;
}

export function Sidebar({ cities, isAdmin }: { cities: City[]; isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white print:hidden">
      <nav className="flex flex-col py-4">
        <Link
          href="/dashboard"
          className={`mx-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${
            pathname === "/dashboard"
              ? "bg-primary/10 text-primary"
              : "text-ink hover:bg-gray-50"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 11.5 12 4l9 7.5" />
            <path d="M5 10v9.5a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
          </svg>
          Inicio
        </Link>

        <p className="mb-1 mt-5 px-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Ciudades
        </p>
        {cities.map((city) => {
          const active = pathname.startsWith(`/ciudades/${city.slug}`);
          return (
            <Link
              key={city.id}
              href={`/ciudades/${city.slug}`}
              className={`mx-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                active
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-ink hover:bg-gray-50"
              }`}
            >
              <CityDot />
              {city.name}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <p className="mb-1 mt-5 px-5 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Administración
            </p>
            <Link
              href="/admin/usuarios"
              className={`mx-2 flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                pathname.startsWith("/admin")
                  ? "bg-accent/10 font-medium text-accent"
                  : "text-ink hover:bg-gray-50"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="3.2" />
                <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
              </svg>
              Panel de administración
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}
