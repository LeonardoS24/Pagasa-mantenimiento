import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { deleteUser } from "@/actions/user-actions";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { CityAccessCheckboxes } from "@/components/admin/CityAccessCheckboxes";
import { ConfirmSubmitButton } from "@/components/admin/ConfirmSubmitButton";
import { roleLabels, type Role } from "@/lib/roles";

export default async function UserDetailPage({
  params,
}: {
  params: { userId: string };
}) {
  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    include: { cityAccess: true },
  });
  if (!user) notFound();

  const cities = await prisma.city.findMany({ orderBy: { order: "asc" } });
  const assignedCityIds = new Set(user.cityAccess.map((access) => access.cityId));

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/usuarios" className="text-sm text-primary hover:underline">
          ← Volver a usuarios
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-primary">{user.username}</h2>
        <p className="text-sm text-ink">{roleLabels[user.role as Role]}</p>
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Cambiar contraseña
        </h3>
        <ChangePasswordForm userId={user.id} />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Ciudades asignadas
        </h3>
        {user.role === "ADMIN" ? (
          <p className="text-sm text-ink">
            Este usuario es administrador y tiene acceso a todas las ciudades.
          </p>
        ) : (
          <CityAccessCheckboxes userId={user.id} cities={cities} assignedCityIds={assignedCityIds} />
        )}
      </section>

      <section className="rounded-lg border border-red-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
          Zona de peligro
        </h3>
        <form action={deleteUser.bind(null, user.id)}>
          <ConfirmSubmitButton
            confirmMessage={`¿Eliminar al usuario “${user.username}”? Perderá el acceso de inmediato, aunque tenga la sesión abierta. Las bitácoras y documentos que registró se conservan. Esta acción no se puede deshacer.`}
            className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
          >
            Eliminar usuario
          </ConfirmSubmitButton>
        </form>
      </section>
    </div>
  );
}
