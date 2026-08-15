import { requireAdmin } from "@/lib/auth";
import {
  getCategoriasPorGrupo,
  getPieceCatalog,
  getPiezasAgregadas,
} from "@/lib/piece-catalog-runtime";
import { PieceCatalogPanel } from "@/components/admin/PieceCatalogPanel";
import { ChecklistPanel } from "@/components/admin/ChecklistPanel";
import { getChecklistItems, getChecklistExtras } from "@/lib/checklist-runtime";

// Catálogo de piezas y refacciones: la lista base vive en el código
// (lib/piece-catalog.ts) y desde aquí se le agregan las que hagan falta con
// el tiempo, sin tener que tocar el sistema.
export default async function AdminPiezasPage() {
  await requireAdmin();

  const [categoriasPorGrupo, catalogo, agregadas, itemsGeneral, itemsCarburacion, checklistExtras] =
    await Promise.all([
      getCategoriasPorGrupo(),
      getPieceCatalog(),
      getPiezasAgregadas(),
      getChecklistItems("GENERAL"),
      getChecklistItems("CARBURACION"),
      getChecklistExtras(),
    ]);

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
        items={{ GENERAL: itemsGeneral, CARBURACION: itemsCarburacion }}
        extras={checklistExtras}
      />
    </div>
  );
}
