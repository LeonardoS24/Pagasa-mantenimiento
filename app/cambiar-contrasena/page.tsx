import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { rutaInternaSegura } from "@/lib/ruta-segura";
import { CambiarContrasenaForm } from "@/components/cuenta/CambiarContrasenaForm";

// Fuera de (protected) a propósito: mientras el cambio está pendiente no se
// muestra el menú ni nada del sistema (middleware.ts solo deja pasar aquí).
// También es donde cualquiera cambia su contraseña cuando quiera (enlace
// "Mi contraseña" de la barra superior).
export default async function CambiarContrasenaPage({ searchParams }: { searchParams?: { from?: string } }) {
  const usuario = await requireUser({ aunqueDebaCambiarContrasena: true });
  const registro = await prisma.user.findUnique({
    where: { id: usuario.userId },
    select: { debeCambiarContrasena: true },
  });
  const obligatorio = registro?.debeCambiarContrasena ?? false;
  const desde = rutaInternaSegura(searchParams?.from);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary via-primary-dark to-accent px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-5 flex flex-col items-center text-center">
          <Image src="/logos/pagasa.png" alt="Pagasa" width={90} height={63} className="mb-3 h-12 w-auto" priority />
          <h1 className="text-lg font-semibold text-primary">
            {obligatorio ? "Pon una contraseña nueva" : "Cambiar mi contraseña"}
          </h1>
          <p className="text-sm text-ink">{usuario.username}</p>
        </div>
        {obligatorio && (
          <p className="mb-4 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-800">
            Antes de continuar tienes que cambiar tu contraseña: es temporal o ya no cumple las reglas de seguridad.
          </p>
        )}
        <CambiarContrasenaForm username={usuario.username} desde={desde} />
        <div className="mt-4 flex justify-between text-sm">
          {!obligatorio ? (
            <Link href={desde ?? "/dashboard"} className="text-primary hover:underline">
              Volver
            </Link>
          ) : (
            <span />
          )}
          <form action="/api/logout" method="POST">
            <button type="submit" className="text-gray-500 hover:underline">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
