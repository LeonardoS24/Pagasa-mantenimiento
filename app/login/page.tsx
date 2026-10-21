import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/login/LoginForm";
import { rutaInternaSegura } from "@/lib/ruta-segura";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { motivo?: string; from?: string };
}) {
  const session = await getSession();
  const desde = rutaInternaSegura(searchParams?.from);
  if (session.userId) {
    redirect(desde ?? "/dashboard");
  }

  const cuentaEliminada = searchParams?.motivo === "cuenta-eliminada";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-accent px-4">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent-light/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

      <div className="relative w-full max-w-sm rounded-xl border border-white/20 bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex items-center gap-4">
            <Image
              src="/logos/pagasa.png"
              alt="Pagasa"
              width={90}
              height={63}
              className="h-14 w-auto"
              priority
            />
            <div className="h-10 w-px bg-gray-200" />
            <Image
              src="/logos/kinogas.png"
              alt="Kino Gas"
              width={90}
              height={63}
              className="h-14 w-auto"
              priority
            />
          </div>
          <h1 className="text-xl font-semibold text-primary">Grupo Pagasa</h1>
          <p className="text-sm text-ink">Sistema Integral de Mantenimiento</p>
        </div>
        {cuentaEliminada && (
          <p className="mb-4 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-800">
            Tu sesión se cerró porque la cuenta ya no existe en el sistema.
            Pide a un administrador que la vuelva a crear.
          </p>
        )}
        <LoginForm desde={desde} />
      </div>
    </div>
  );
}
