import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CustomFieldsPanel, type CampoConUso, type RecuadroPropio } from "@/components/admin/CustomFieldsPanel";
import { parseOpcionesTexto, seccionDePropia, type CampoAmbito, type CampoTipo } from "@/lib/custom-fields";

// Formato de las fichas técnicas por apartado (ver lib/custom-fields.ts): se
// agregan, editan, mueven y quitan campos y recuadros nuevos desde aquí, sin
// tocar los campos de fábrica ni las alertas.
export default async function AdminCamposPage() {
  await requireAdmin();

  const [filas, secciones] = await Promise.all([
    prisma.customField.findMany({
      orderBy: [{ ambito: "asc" }, { seccion: "asc" }, { orden: "asc" }],
      include: { _count: { select: { valores: true } } },
    }),
    prisma.customSection.findMany({ orderBy: [{ ambito: "asc" }, { orden: "asc" }, { createdAt: "asc" }] }),
  ]);

  const campos: CampoConUso[] = filas.map((f) => ({
    id: f.id,
    ambito: f.ambito as CampoAmbito,
    seccion: f.seccion,
    apartadoSlug: f.apartadoSlug,
    etiqueta: f.etiqueta,
    tipo: f.tipo as CampoTipo,
    orden: f.orden,
    usos: f._count.valores,
    opciones: f.tipo === "LISTA" ? parseOpcionesTexto(f.opciones) : undefined,
  }));

  const recuadros: RecuadroPropio[] = secciones.map((s) => ({
    id: s.id,
    ambito: s.ambito as CampoAmbito,
    apartadoSlug: s.apartadoSlug,
    titulo: s.titulo,
    orden: s.orden,
    campos: filas.filter((f) => f.seccion === seccionDePropia(s.id)).length,
  }));

  return <CustomFieldsPanel campos={campos} recuadros={recuadros} />;
}
