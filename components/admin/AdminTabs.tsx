"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/ciudades", label: "Ciudades y apartados" },
  { href: "/admin/alertas", label: "Alertas" },
  { href: "/admin/piezas", label: "Piezas y refacciones" },
  { href: "/admin/actividad", label: "Actividad del sistema" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-2 border-b border-gray-200">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              active
                ? "border-accent text-primary"
                : "border-transparent text-ink hover:text-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
