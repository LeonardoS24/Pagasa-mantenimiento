import { prisma } from "@/lib/prisma";
import {
  CHECKLIST_LISTAS,
  CHECKLIST_BASE,
  LEAK_CHECK_BASE,
  OTHER_CHECKLIST_ITEM,
  type ChecklistLista,
} from "@/lib/preventive-checklist";

// El checklist de mantenimiento preventivo es la lista fija del código
// (lib/preventive-checklist.ts, una por tipo de unidad) MÁS los ítems que un
// ADMIN agregue desde el panel (tabla checklist_items_extra, ver
// actions/checklist-actions.ts).
//
// Los formularios deben leerlo con estas funciones, no importando las
// constantes directo, o los ítems agregados no aparecerían.
export { CHECKLIST_LISTAS, checklistListaLabels, checklistListaDeApartado, type ChecklistLista } from "@/lib/preventive-checklist";

export type ChecklistItemExtra = {
  id: string;
  lista: ChecklistLista;
  nombre: string;
  soloFugas: boolean;
};

export async function getChecklistExtras(): Promise<ChecklistItemExtra[]> {
  const filas = await prisma.checklistItemExtra.findMany({
    orderBy: [{ lista: "asc" }, { orden: "asc" }, { nombre: "asc" }],
  });
  return filas.map((f) => ({
    id: f.id,
    lista: f.lista as ChecklistLista,
    nombre: f.nombre,
    soloFugas: f.soloFugas,
  }));
}

// "Otro" siempre se queda al final: es el cajón para lo que no está
// listado, así que no tiene caso dejarlo a media lista cuando se agregan
// ítems nuevos.
export async function getChecklistItems(lista: ChecklistLista): Promise<string[]> {
  const extras = (await getChecklistExtras()).filter((e) => e.lista === lista).map((e) => e.nombre);
  const base: string[] = [...CHECKLIST_BASE[lista]];

  if (extras.length === 0) return base;

  const sinOtro = base.filter((i) => i !== OTHER_CHECKLIST_ITEM);
  const tieneOtro = base.includes(OTHER_CHECKLIST_ITEM);
  const nuevos = extras.filter((e) => !base.includes(e));
  return tieneOtro ? [...sinOtro, ...nuevos, OTHER_CHECKLIST_ITEM] : [...sinOtro, ...nuevos];
}

// Ítems de esa lista que solo se revisan por fugas, incluyendo los agregados
// a mano marcados así (ver checklistEstadoOptionsFor en
// lib/preventive-checklist.ts).
export async function getLeakCheckItems(lista: ChecklistLista): Promise<string[]> {
  const extras = await getChecklistExtras();
  return [
    ...LEAK_CHECK_BASE[lista],
    ...extras.filter((e) => e.lista === lista && e.soloFugas).map((e) => e.nombre),
  ];
}

// Todos los nombres válidos de ítem, para validar el checklist que llega del
// formulario (ver parseChecklistPreventivo): sin esto, un ítem agregado a
// mano haría que se descartara el checklist completo al guardar.
export async function getAllChecklistItemNames(): Promise<string[]> {
  const extras = await getChecklistExtras();
  return [...CHECKLIST_LISTAS.flatMap((l) => CHECKLIST_BASE[l]), ...extras.map((e) => e.nombre)];
}
