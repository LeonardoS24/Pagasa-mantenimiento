import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { UserTable } from "@/components/admin/UserTable";
import { CreateUserForm } from "@/components/admin/CreateUserForm";

export default async function UsuariosPage() {
  const session = await getSession();
  const users = await prisma.user.findMany({ orderBy: { username: "asc" } });

  return (
    <div className="space-y-6">
      <CreateUserForm />
      <UserTable users={users} currentUserId={session.userId!} />
    </div>
  );
}
