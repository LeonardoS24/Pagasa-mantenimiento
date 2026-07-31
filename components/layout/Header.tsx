import Image from "next/image";
import { logoutAction } from "@/actions/auth-actions";
import type { SessionData } from "@/lib/session";
import { roleLabels } from "@/lib/roles";

export function Header({ user }: { user: SessionData }) {
  return (
    <header className="flex h-16 items-center justify-between bg-primary px-6 text-white">
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
      <div className="flex items-center gap-4 text-sm">
        <span>
          {user.username} <span className="text-blue-200">({roleLabels[user.role]})</span>
        </span>
        <form action={logoutAction}>
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
