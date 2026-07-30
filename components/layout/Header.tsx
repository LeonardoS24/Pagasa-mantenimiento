import { logoutAction } from "@/actions/auth-actions";
import type { SessionData } from "@/lib/session";

export function Header({ user }: { user: SessionData }) {
  return (
    <header className="flex h-16 items-center justify-between bg-primary px-6 text-white">
      <div>
        <p className="font-semibold leading-tight">Grupo Pagasa</p>
        <p className="text-xs leading-tight text-blue-100">Sistema Integral de Mantenimiento</p>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span>
          {user.username} <span className="text-blue-200">({user.role === "ADMIN" ? "Administrador" : "Usuario"})</span>
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
