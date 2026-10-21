import { requireAdmin } from "@/lib/auth";
import { getRequisitos } from "@/lib/requisitos-runtime";
import { NormasPanel } from "@/components/admin/NormasPanel";

// Catálogo de requisitos normativos: qué norma respalda cada alerta y con qué
// plazo (ver lib/requisitos-normativos.ts). Aquí se ajusta cuando una norma
// cambia, sin tener que modificar el sistema.
export default async function AdminNormasPage() {
  await requireAdmin();
  return <NormasPanel requisitos={await getRequisitos()} />;
}
