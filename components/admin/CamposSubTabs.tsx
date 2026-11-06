"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SUBTABS = [
  { href: "/admin/campos", label: "Campos y recuadros", exacto: true },
  { href: "/admin/campos/acomodar", label: "Acomodar fichas", exacto: false },
];

export function CamposSubTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-5 flex flex-wrap gap-2">
      {SUBTABS.map((t) => {
        const activa = t.exacto ? pathname === t.href : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={activa ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              activa ? "border-accent bg-accent text-white shadow-sm" : "border-gray-300 bg-white text-ink hover:border-accent hover:text-primary"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
