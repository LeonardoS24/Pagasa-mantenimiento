"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pestañas secundarias dentro de una pestaña del panel de administración
// (Editar sistema, Alertas). La activa va rellena de color.
export type SubPestana = { href: string; label: string; exacto?: boolean };

export function SubPestanas({ pestanas }: { pestanas: SubPestana[] }) {
  const pathname = usePathname();
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {pestanas.map((t) => {
        const activa = t.exacto ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activa ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              activa
                ? "border-accent bg-accent text-white shadow-sm"
                : "border-gray-300 bg-white text-ink hover:border-accent hover:text-primary"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
