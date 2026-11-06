import { prisma } from "@/lib/prisma";
import { exige2faAAdmins } from "@/lib/doble-verificacion";
import { leerHuellas } from "@/lib/totp";

// Mi cuenta: lo que cualquier persona hace con su propia cuenta (cambiar la
// contraseña, activar la doble verificación). Lo usan /mi-cuenta (todos los
// usuarios) y la pestaña «Mi cuenta» del panel de administración
// (/admin/mi-cuenta). Las dos pantallas a las que lleva viven fuera de
// (protected) a propósito (ver app/cambiar-contrasena/page.tsx) y regresan
// a `volver` con ?from=.
export async function MiCuentaPanel({ userId, username, role, volver }: { userId: string; username: string; role: string; volver: string }) {
  const cuenta = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpActivo: true, totpRespaldo: true, contrasenaCambiadaEl: true },
  });
  const activa = cuenta?.totpActivo ?? false;
  const restantes = leerHuellas(cuenta?.totpRespaldo).length;
  const desde = encodeURIComponent(volver);

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink">
        Tu cuenta: <strong>{username}</strong>
      </p>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-2 text-sm font-semibold uppercase text-primary-bright">Mi contraseña</h3>
        <p className="mb-3 text-sm text-ink">
          Cámbiala cuando quieras. Pide 10 caracteres como mínimo, con letras y números. Al cambiarla se cierran tus sesiones en otros equipos.
        </p>
        {cuenta?.contrasenaCambiadaEl && (
          <p className="mb-3 text-xs text-gray-600">
            Último cambio: {cuenta.contrasenaCambiadaEl.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}.
          </p>
        )}
        <a href={`/cambiar-contrasena?from=${desde}`} className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark">
          Cambiar mi contraseña
        </a>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-2 text-sm font-semibold uppercase text-primary-bright">Doble verificación</h3>
        {activa ? (
          <p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
            <strong>Activa.</strong> Al iniciar sesión se pide un código de tu teléfono. Te quedan {restantes} códigos de recuperación sin usar.
          </p>
        ) : (
          <p className="mb-3 rounded-md bg-orange-50 px-3 py-2 text-sm text-orange-800">
            <strong>No está activada.</strong> Con ella, aunque alguien conozca tu contraseña no puede entrar sin el código de tu teléfono.
            {exige2faAAdmins() && role === "ADMIN" && " La empresa la exige a los administradores."}
          </p>
        )}
        <a href={`/doble-verificacion?from=${desde}`} className="inline-block rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-primary-dark">
          {activa ? "Ver o administrar" : "Activar la doble verificación"}
        </a>
      </section>
    </div>
  );
}
