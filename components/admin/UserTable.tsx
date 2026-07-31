import Link from "next/link";
import type { User } from "@prisma/client";
import { deleteUser } from "@/actions/user-actions";
import { roleLabels, type Role } from "@/lib/roles";
import { ConfirmSubmitButton } from "./ConfirmSubmitButton";

export function UserTable({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-2">Usuario</th>
            <th className="px-4 py-2">Rol</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-gray-100">
              <td className="px-4 py-2">
                <Link href={`/admin/usuarios/${user.id}`} className="text-primary hover:underline">
                  {user.username}
                </Link>
              </td>
              <td className="px-4 py-2 text-ink">{roleLabels[user.role as Role]}</td>
              <td className="px-4 py-2 text-right">
                {user.id !== currentUserId && (
                  <form action={deleteUser.bind(null, user.id)}>
                    <ConfirmSubmitButton
                      confirmMessage={`¿Eliminar al usuario "${user.username}"? Esta acción no se puede deshacer.`}
                      className="text-sm text-accent hover:underline"
                    >
                      Eliminar
                    </ConfirmSubmitButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
