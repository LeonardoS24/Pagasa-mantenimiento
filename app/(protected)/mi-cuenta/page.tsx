import { requireUser } from "@/lib/auth";
import { MiCuentaPanel } from "@/components/cuenta/MiCuentaPanel";

// Mi cuenta para todos los usuarios: se llega con el nombre de la barra
// superior o, quien no tiene panel de administración, con el menú lateral.
export default async function MiCuentaPage() {
  const usuario = await requireUser();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold text-primary">Mi cuenta</h1>
      <MiCuentaPanel userId={usuario.userId} username={usuario.username} role={usuario.role} volver="/mi-cuenta" />
    </div>
  );
}
