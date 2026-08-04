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
    <div className="flex h-screen flex-col print:block print:h-auto">
      <Header user={user} />
      <div className="flex flex-1 overflow-hidden print:block print:overflow-visible">
        <Sidebar cities={cities} isAdmin={user.role === "ADMIN"} />
        <main className="flex-1 overflow-y-auto bg-slate-50 p-6 print:overflow-visible print:bg-white print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}
