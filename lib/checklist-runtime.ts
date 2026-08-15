import { prisma } from "@/lib/prisma";
import {
  PREVENTIVE_CHECKLIST_ITEMS,
  CARBURACION_CHECKLIST_ITEMS,
  CARBURACION_LEAK_CHECK_ITEMS,
} from "@/lib/preventive-checklist";

// El checklist de mantenimiento preventivo es la lista fija del código
// (lib/preventive-checklist.ts) MÁS los ítems que un ADMIN agregue desde el
// panel (tabla checklist_items_extra, ver actions/checklist-actions.ts).
//
// Los formularios deben leerlo con estas funciones, no importando las
// constantes directo, o los ítems agregados no aparecerían.
export const CHECKLIST_LISTAS = ["GENERAL", "CARBURACION"] as const;
export type ChecklistLista = (typeof CHECKLIST_LISTAS)[number];

export const checklistListaLabels: Record<ChecklistLista, string> = {
  GENERAL: "Unidades en general",
  CARBURACION: "Vehículo con tanque de carburación",
};

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

// "Otro" siempre se queda al final de la lista genérica: es el cajón para lo
// que no está listado, así que no tiene caso dejarlo a media lista cuando se
// agregan ítems nuevos.
const ITEM_OTRO = "Otro";

export async function getChecklistItems(lista: ChecklistLista): Promise<string[]> {
  const extras = (await getChecklistExtras()).filter((e) => e.lista === lista).map((e) => e.nombre);
  const base: string[] =
    lista === "CARBURACION"
      ? [...CARBURACION_CHECKLIST_ITEMS]
      : [...PREVENTIVE_CHECKLIST_ITEMS];

  if (extras.length === 0) return base;

  const sinOtro = base.filter((i) => i !== ITEM_OTRO);
  const tieneOtro = base.includes(ITEM_OTRO);
  const nuevos = extras.filter((e) => !base.includes(e));
  return tieneOtro ? [...sinOtro, ...nuevos, ITEM_OTRO] : [...sinOtro, ...nuevos];
}

// Ítems del checklist de carburación que solo se revisan por fugas,
// incluyendo los agregados a mano marcados así (ver
// checklistEstadoOptionsFor en lib/preventive-checklist.ts).
export async function getLeakCheckItems(): Promise<string[]> {
  const extras = await getChecklistExtras();
  return [
    ...CARBURACION_LEAK_CHECK_ITEMS,
    ...extras.filter((e) => e.lista === "CARBURACION" && e.soloFugas).map((e) => e.nombre),
  ];
}

// Todos los nombres válidos de ítem, para validar el checklist que llega del
// formulario (ver parseChecklistPreventivo): sin esto, un ítem agregado a
// mano haría que se descartara el checklist completo al guardar.
export async function getAllChecklistItemNames(): Promise<string[]> {
  const extras = await getChecklistExtras();
  return [
    ...PREVENTIVE_CHECKLIST_ITEMS,
    ...CARBURACION_CHECKLIST_ITEMS,
    ...extras.map((e) => e.nombre),
  ];
}
