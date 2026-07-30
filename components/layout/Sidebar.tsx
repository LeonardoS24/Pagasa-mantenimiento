"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { City } from "@prisma/client";

export function Sidebar({ cities, isAdmin }: { cities: City[]; isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
      <nav className="flex flex-col py-4">
        <Link
          href="/dashboard"
          className={`px-4 py-2 text-sm font-medium ${
            pathname === "/dashboard"
              ? "border-l-4 border-accent text-primary"
              : "border-l-4 border-transparent text-ink hover:bg-gray-50"
          }`}
        >
          Inicio
        </Link>

        <p className="mt-4 px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
          Ciudades
        </p>
        {cities.map((city) => {
          const active = pathname.startsWith(`/ciudades/${city.slug}`);
          return (
            <Link
              key={city.id}
              href={`/ciudades/${city.slug}`}
              className={`px-4 py-2 text-sm ${
                active
                  ? "border-l-4 border-accent font-medium text-primary"
                  : "border-l-4 border-transparent text-ink hover:bg-gray-50"
              }`}
            >
              {city.name}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <p className="mt-4 px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
              Administración
            </p>
            <Link
              href="/admin/usuarios"
              className={`px-4 py-2 text-sm ${
                pathname.startsWith("/admin")
                  ? "border-l-4 border-accent font-medium text-primary"
                  : "border-l-4 border-transparent text-ink hover:bg-gray-50"
              }`}
            >
              Panel de administración
            </Link>
          </>
        )}
      </nav>
    </aside>
  );
}
