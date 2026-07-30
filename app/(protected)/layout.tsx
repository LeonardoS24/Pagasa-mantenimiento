import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAccessibleCities } from "@/lib/access";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.userId) {
    redirect("/login");
  }

  const user = { userId: session.userId, username: session.username, role: session.role };
  const cities = await getAccessibleCities(user);

  return (
    <div className="flex h-screen flex-col">
      <Header user={user} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar cities={cities} isAdmin={user.role === "ADMIN"} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
