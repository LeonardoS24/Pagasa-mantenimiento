import { requireAdmin } from "@/lib/auth";
import { MiCuentaPanel } from "@/components/cuenta/MiCuentaPanel";

// La pestaña «Mi cuenta» del panel de administración. Cualquier otro usuario
// la tiene en /mi-cuenta (app/(protected)/mi-cuenta/page.tsx).
export default async function MiCuentaAdminPage() {
  const admin = await requireAdmin();
  return <MiCuentaPanel userId={admin.userId} username={admin.username} role={admin.role} volver="/admin/mi-cuenta" />;
}
