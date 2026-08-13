import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { deleteUser } from "@/actions/user-actions";
import { ChangePasswordForm } from "@/components/admin/ChangePasswordForm";
import { ChangeRoleForm } from "@/components/admin/ChangeRoleForm";
import { CityAccessCheckboxes } from "@/components/admin/CityAccessCheckboxes";
import { ConfirmDeleteRecordWithPassword } from "@/components/admin/ConfirmDeleteRecordWithPassword";
import { ElevatedAccessForm } from "@/components/admin/ElevatedAccessForm";
import { roleLabels, type Role } from "@/lib/roles";
import { parseElevatedAccessSchedule } from "@/lib/elevated-access";

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

  const admin = await requireAdmin();
  const esMiCuenta = admin.userId === user.id;

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
        <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
          Rol
        </h3>
        <ChangeRoleForm userId={user.id} currentRole={user.role as Role} esMiCuenta={esMiCuenta} />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
          Cambiar contraseña
        </h3>
        <ChangePasswordForm userId={user.id} />
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
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

      {user.role === "USUARIO" && (
        <section className="rounded-lg border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase text-primary-bright">
            Acceso ampliado por horario
          </h3>
          <ElevatedAccessForm userId={user.id} schedule={parseElevatedAccessSchedule(user)} />
        </section>
      )}

      <section className="rounded-lg border border-red-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-600">
          Zona de peligro
        </h3>
        <ConfirmDeleteRecordWithPassword
          mensaje={`¿Eliminar al usuario "${user.username}"? Perderá el acceso de inmediato, aunque tenga la sesión abierta. Las bitácoras y documentos que registró se conservan. Esta acción no se puede deshacer.`}
          action={deleteUser.bind(null, user.id)}
          className="rounded-md border border-accent px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
        >
          Eliminar usuario
        </ConfirmDeleteRecordWithPassword>
      </section>
    </div>
  );
}
