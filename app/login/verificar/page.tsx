import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { leerPendiente2fa } from "@/lib/pendiente-2fa";
import { VerificarCodigoForm } from "@/components/login/VerificarCodigoForm";

// Segundo paso del inicio de sesión (doble verificación). Cuelga de /login a
// propósito: el middleware deja pasar todo lo que empieza con «login» sin
// sesión, y aquí todavía no la hay (ver lib/pendiente-2fa.ts).
export default async function VerificarPage() {
  const session = await getSession();
  if (session.userId) redirect("/dashboard");
  if (!(await leerPendiente2fa())) redirect("/login?motivo=expirada");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary via-primary-dark to-accent px-4">
      <div className="relative w-full max-w-sm rounded-xl border border-white/20 bg-white p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logos/pagasa.png" alt="Pagasa" width={90} height={63} className="mb-3 h-12 w-auto" priority />
          <h1 className="text-lg font-semibold text-primary">Doble verificación</h1>
          <p className="text-sm text-ink">Falta un último paso para entrar.</p>
        </div>
        <VerificarCodigoForm />
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="text-gray-500 hover:underline">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
