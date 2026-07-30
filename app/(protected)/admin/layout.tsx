import { requireAdmin } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/AdminTabs";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-primary">Panel de administración</h1>
      <AdminTabs />
      {children}
    </div>
  );
}
