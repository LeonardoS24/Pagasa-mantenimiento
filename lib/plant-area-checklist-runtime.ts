import { prisma } from "@/lib/prisma";

// Checklist de mantenimiento de un área de Planta: la lista base fija del
// código MÁS los ítems que un ADMIN agregue por área desde el panel (tabla
// plant_area_checklist_items, ver PlantAreaChecklistItem). Mismo patrón que
// lib/checklist-runtime.ts, pero por área en vez de por "lista".
//
// Por ahora la base es la misma para las 15 áreas (Limpieza, Inspección de
// equipos); el desglose específico por área llegará después y se agregará
// aquí como ítems extra sin tocar el código de los formularios.
export const PLANT_AREA_CHECKLIST_BASE_ITEMS = ["Limpieza", "Inspección de equipos"] as const;

export type PlantAreaChecklistItemExtra = {
  id: string;
  area: string;
  nombre: string;
};

export async function getPlantAreaChecklistExtras(): Promise<PlantAreaChecklistItemExtra[]> {
  const filas = await prisma.plantAreaChecklistItem.findMany({
    orderBy: [{ area: "asc" }, { orden: "asc" }, { nombre: "asc" }],
  });
  return filas.map((f) => ({ id: f.id, area: f.area, nombre: f.nombre }));
}

export async function getPlantAreaChecklistItems(area: string): Promise<string[]> {
  const extras = (await getPlantAreaChecklistExtras())
    .filter((e) => e.area === area)
    .map((e) => e.nombre);
  const base: string[] = [...PLANT_AREA_CHECKLIST_BASE_ITEMS];
  return [...base, ...extras.filter((e) => !base.includes(e))];
}

// Todos los nombres válidos de ítem para un área, para validar el checklist
// que llega del formulario (ver actions/plant-area-actions.ts).
export async function getAllPlantAreaChecklistItemNames(area: string): Promise<string[]> {
  return getPlantAreaChecklistItems(area);
}
