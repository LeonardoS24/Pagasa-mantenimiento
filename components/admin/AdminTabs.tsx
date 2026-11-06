"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/ciudades", label: "Ciudades y apartados" },
  { href: "/admin/alertas", label: "Alertas" },
  { href: "/admin/normas", label: "Normas y plazos" },
  { href: "/admin/reportes", label: "Reportes por correo" },
  { href: "/admin/piezas", label: "Piezas y refacciones" },
  { href: "/admin/campos", label: "Editar sistema" },
  { href: "/admin/estado", label: "Estado del servidor" },
  { href: "/admin/respaldos", label: "Respaldos" },
  { href: "/admin/actividad", label: "Actividad del sistema" },
  { href: "/admin/accesos", label: "Bitácora de acceso" },
  { href: "/admin/mi-cuenta", label: "Mi cuenta" },
];

export function AdminTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap gap-2 border-b-2 border-primary pb-2">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-primary text-white shadow"
                : "bg-gray-100 text-ink hover:bg-gray-200 hover:text-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
