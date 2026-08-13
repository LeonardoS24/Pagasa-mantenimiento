import Link from "next/link";
import type { User } from "@prisma/client";
import { deleteUser } from "@/actions/user-actions";
import { roleLabels, type Role } from "@/lib/roles";
import { ConfirmDeleteRecordWithPassword } from "./ConfirmDeleteRecordWithPassword";

export function UserTable({ users, currentUserId }: { users: User[]; currentUserId: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-500">
          <tr>
            <th className="px-4 py-2">Usuario</th>
            <th className="px-4 py-2">Rol</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="relative border-t border-gray-100 hover:bg-gray-50">
              <td className="px-4 py-2">
                {/* Estira el link a toda la fila (no solo el nombre): "tr" es
                    "relative" y este link "absolute inset-0" toma su tamaño
                    completo. El link visible de abajo sigue ahí para que el
                    texto se vea subrayado/enfocable como antes. */}
                <Link href={`/admin/usuarios/${user.id}`} className="absolute inset-0" aria-label={user.username} />
                <Link href={`/admin/usuarios/${user.id}`} className="relative text-primary hover:underline" tabIndex={-1}>
                  {user.username}
                </Link>
              </td>
              <td className="px-4 py-2 text-ink">{roleLabels[user.role as Role]}</td>
              <td className="relative px-4 py-2 text-right">
                {user.id !== currentUserId && (
                  <ConfirmDeleteRecordWithPassword
                    mensaje={`¿Eliminar al usuario "${user.username}"? Perderá el acceso de inmediato, aunque tenga la sesión abierta. Las bitácoras y documentos que registró se conservan. Esta acción no se puede deshacer.`}
                    action={deleteUser.bind(null, user.id)}
                    className="text-sm text-accent hover:underline"
                  >
                    Eliminar
                  </ConfirmDeleteRecordWithPassword>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
