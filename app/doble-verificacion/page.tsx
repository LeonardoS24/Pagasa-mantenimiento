import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { descifrarSecreto } from "@/lib/secretos";
import { exige2faAAdmins } from "@/lib/doble-verificacion";
import { leerHuellas, uriOtpauth } from "@/lib/totp";
import { ConfirmarActivacion, EmpezarActivacion, QuitarActivacion } from "@/components/cuenta/DobleVerificacionPanel";

// Fuera de (protected) a propósito, igual que cambiar-contrasena: cuando la
// empresa la exige a los administradores, mientras no la activen no se muestra
// el menú ni nada del sistema (middleware.ts solo deja pasar aquí).
export default async function DobleVerificacionPage() {
  const usuario = await requireUser({ aunqueFalte2fa: true });
  const registro = await prisma.user.findUnique({
    where: { id: usuario.userId },
    select: { totpActivo: true, totpSecreto: true, totpRespaldo: true },
  });
  const activa = registro?.totpActivo ?? false;
  const secreto = !activa ? descifrarSecreto(registro?.totpSecreto) : null;
  const exigida = exige2faAAdmins() && usuario.role === "ADMIN";
  const obligatoria = exigida && !activa;
  const qr = secreto ? await QRCode.toDataURL(uriOtpauth({ usuario: usuario.username, secreto }), { margin: 1, width: 220 }) : null;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-primary via-primary-dark to-accent px-4 py-8">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow-2xl">
        <div className="mb-5 flex flex-col items-center text-center">
          <Image src="/logos/pagasa.png" alt="Pagasa" width={90} height={63} className="mb-3 h-12 w-auto" priority />
          <h1 className="text-lg font-semibold text-primary">Doble verificación</h1>
          <p className="text-sm text-ink">{usuario.username}</p>
        </div>

        {obligatoria && (
          <p className="mb-4 rounded-md border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-800">
            La empresa exige la doble verificación a los administradores. Actívala para continuar.
          </p>
        )}

        {activa ? (
          <div className="space-y-4">
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
              Está <strong>activa</strong>: al iniciar sesión se pide un código de tu teléfono. Te quedan {leerHuellas(registro?.totpRespaldo).length} códigos de recuperación sin usar.
            </p>
            {exigida ? (
              <p className="text-sm text-ink">La empresa la exige a los administradores, así que no se puede quitar. Si perdiste el teléfono, otro administrador puede restablecerla.</p>
            ) : (
              <QuitarActivacion />
            )}
          </div>
        ) : secreto && qr ? (
          <ConfirmarActivacion qr={qr} secreto={secreto} />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink">
              Agrega un segundo paso al iniciar sesión: además de tu contraseña, un código de 6 dígitos que cambia cada 30 segundos y que solo muestra tu teléfono. Así, aunque
              alguien conozca tu contraseña, no puede entrar.
            </p>
            <EmpezarActivacion />
          </div>
        )}

        <div className="mt-5 flex justify-between text-sm">
          {!obligatoria ? (
            <Link href="/dashboard" className="text-primary hover:underline">
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
