import { requireUser } from "@/lib/auth";
import { getAccessibleCities } from "@/lib/access";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";
import { LoginAlertToasts } from "@/components/layout/LoginAlertToasts";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // requireUser revalida la cuenta contra la base en cada request: si fue
  // eliminada, aquí se corta el acceso a todo el árbol protegido.
  const user = await requireUser();
  const cities = await getAccessibleCities(user);

  return (
    <div className="flex h-screen flex-col print:block print:h-auto">
      <LoginAlertToasts />
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
