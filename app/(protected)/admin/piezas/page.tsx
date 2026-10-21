import { requireAdmin } from "@/lib/auth";
import {
  getCategoriasPorGrupo,
  getPieceCatalog,
  getPiezasAgregadas,
} from "@/lib/piece-catalog-runtime";
import { PieceCatalogPanel } from "@/components/admin/PieceCatalogPanel";
import { ChecklistPanel } from "@/components/admin/ChecklistPanel";
import { getChecklistItems, getChecklistExtras, CHECKLIST_LISTAS } from "@/lib/checklist-runtime";

// Catálogo de piezas y refacciones: la lista base vive en el código
// (lib/piece-catalog.ts) y desde aquí se le agregan las que hagan falta con
// el tiempo, sin tener que tocar el sistema.
export default async function AdminPiezasPage() {
  await requireAdmin();

  const [categoriasPorGrupo, catalogo, agregadas, checklistExtras] = await Promise.all([
    getCategoriasPorGrupo(),
    getPieceCatalog(),
    getPiezasAgregadas(),
    getChecklistExtras(),
  ]);
  // Un checklist preventivo por tipo de unidad (ver lib/preventive-checklist.ts).
  const itemsChecklist = Object.fromEntries(
    await Promise.all(CHECKLIST_LISTAS.map(async (lista) => [lista, await getChecklistItems(lista)] as const))
  ) as Record<(typeof CHECKLIST_LISTAS)[number], string[]>;

  return (
    <div className="space-y-8">
      <PieceCatalogPanel
        categoriasPorGrupo={categoriasPorGrupo}
        catalogo={catalogo}
        agregadas={agregadas.map((p) => ({
          id: p.id,
          categoria: p.categoria,
          nombre: p.nombre,
          grupo: p.grupo,
        }))}
      />
      <ChecklistPanel
        items={itemsChecklist}
        extras={checklistExtras}
      />
    </div>
  );
}
