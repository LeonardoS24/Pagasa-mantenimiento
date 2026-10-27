import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRequisitos } from "@/lib/requisitos-runtime";
import { avisosDeVigencia } from "@/lib/requisitos-normativos";
import { NormasPanel } from "@/components/admin/NormasPanel";

// Catálogo de requisitos normativos: qué norma respalda cada alerta y con qué
// plazo (ver lib/requisitos-normativos.ts). Aquí se ajusta cuando una norma
// cambia, sin tener que modificar el sistema.
export default async function AdminNormasPage() {
  await requireAdmin();
  // El historial sale de la bitácora de actividad (actions/requisitos-actions.ts
  // anota cada cambio con lo que había antes y lo que quedó).
  const cambios = await prisma.activityLog.findMany({
    where: { entidad: "Requisito normativo" },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <NormasPanel
      requisitos={await getRequisitos()}
      avisos={avisosDeVigencia()}
      historial={cambios.map((c) => ({
        id: c.id,
        fecha: c.createdAt.toISOString(),
        usuario: c.username,
        requisito: c.resumen,
        detalle: c.detalle,
      }))}
    />
  );
}
