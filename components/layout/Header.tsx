"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import type { UsuarioSesion } from "@/lib/session";
import { CentroDeAvisos } from "./CentroDeAvisos";

export function Header({ user }: { user: UsuarioSesion }) {
  const pathname = usePathname();
  // El buscador grande vive en el inicio (dashboard), justo encima de
  // Ciudades; el de la barra superior solo aparece en el resto de las
  // páginas (dentro de un apartado) para no duplicarlo.
  const showHeaderSearch = pathname !== "/dashboard";

  return (
    // Barra azul sólida sin bordes redondeados, como la navegación de
    // grupopagasa.com.mx; la línea inferior naranja es el acento de marca.
    <header className="flex h-16 items-center justify-between border-b-[3px] border-accent bg-primary px-6 text-white shadow-sm print:hidden">
      <div className="flex items-center gap-3">
        <div className="rounded-md bg-white px-2.5 py-1.5 shadow-sm">
          <Image
            src="/logos/header-logo.png"
            alt="Grupo Pagasa · Kino Gas"
            width={180}
            height={24}
            className="h-6 w-auto"
            priority
          />
        </div>
        <p className="hidden text-xs leading-tight text-blue-100 sm:block">
          Sistema Integral de Mantenimiento
        </p>
      </div>
      {showHeaderSearch && (
        <form action="/buscar" method="GET" className="hidden flex-1 max-w-xs md:block">
          <input
            type="search"
            name="q"
            placeholder="Buscar número económico, placas..."
            className="w-full rounded-md border border-white/30 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-blue-100 focus:bg-white focus:text-ink focus:outline-none focus:ring-2 focus:ring-white/60"
          />
        </form>
      )}
      <div className="flex items-center gap-4 text-sm">
        <span>
          {user.username}
          {user.puesto && <span className="text-blue-200"> — {user.puesto}</span>}
        </span>
        <CentroDeAvisos />
        <a href="/cambiar-contrasena" className="hidden text-blue-100 hover:text-white hover:underline sm:inline">
          Mi contraseña
        </a>
        <form action="/api/logout" method="POST">
          <button
            type="submit"
            className="rounded-md border border-white/40 px-3 py-1 text-sm transition hover:bg-white/10"
          >
            Cerrar sesión
          </button>
        </form>
      </div>
    </header>
  );
}
