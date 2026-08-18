import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomFieldsPanel, type CampoConUso } from "@/components/admin/CustomFieldsPanel";
import { parseOpcionesTexto, type CampoAmbito, type CampoTipo } from "@/lib/custom-fields";

// Recuadros extra de las fichas técnicas (ver lib/custom-fields.ts): se
// agregan, renombran, mueven y quitan desde aquí, sin tocar los campos de
// fábrica ni las alertas.
export default async function AdminCamposPage() {
  await requireAdmin();

  const filas = await prisma.customField.findMany({
    orderBy: [{ ambito: "asc" }, { seccion: "asc" }, { orden: "asc" }],
    include: { _count: { select: { valores: true } } },
  });

  const campos: CampoConUso[] = filas.map((f) => ({
    id: f.id,
    ambito: f.ambito as CampoAmbito,
    seccion: f.seccion,
    etiqueta: f.etiqueta,
    tipo: f.tipo as CampoTipo,
    orden: f.orden,
    usos: f._count.valores,
    opciones: f.tipo === "LISTA" ? parseOpcionesTexto(f.opciones) : undefined,
  }));

  return <CustomFieldsPanel campos={campos} />;
}
