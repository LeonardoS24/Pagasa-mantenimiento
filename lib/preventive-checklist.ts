import { z } from "zod";

// Checklist fijo que se llena cuando el tipo de mantenimiento es
// "Preventivo" (ver components/admin/CreateMaintenanceLogForm.tsx). Cada
// ítem se revisa y se marca con uno de los 4 estados; "Relleno", "Lubricación"
// y "Cambio" generan cada uno su propio registro de pieza documentada (ver
// actions/maintenance-actions.ts) — "Buen estado" no genera nada, solo queda
// en el checklist guardado.
export const PREVENTIVE_CHECKLIST_ITEMS = [
  "Aceite del motor",
  "Filtro de aceite",
  "Filtro de aire del motor",
  "Filtro de cabina (A/C)",
  "Filtro de combustible",
  "Refrigerante",
  "Líquido de frenos",
  "Líquido de dirección hidráulica",
  "Aceite de transmisión",
  "Aceite diferencial",
  "Líquido limpiaparabrisas",
  "Batería",
  "Sistema de carga",
  "Motor de arranque",
  "Bandas o correas",
  "Mangueras",
  "Radiador",
  "Sistema de enfriamiento",
  "Frenos",
  "Llantas",
  "Suspensión",
  "Dirección",
  "Sistema de escape",
  "Luces",
  "Limpiaparabrisas",
  "Claxon",
  "Aire acondicionado",
  "Escáner OBD-II",
  "Tornillería",
  "Lubricación",
  "Otro",
] as const;

export type PreventiveChecklistItem = (typeof PREVENTIVE_CHECKLIST_ITEMS)[number];

export const checklistEstadoSchema = z.enum(["Buen estado", "Relleno", "Lubricación", "Cambio"]);
export type ChecklistEstado = z.infer<typeof checklistEstadoSchema>;
export const checklistEstadoOptions = checklistEstadoSchema.options;

export const DEFAULT_CHECKLIST_ESTADO: ChecklistEstado = "Buen estado";

export interface ChecklistEntry {
  item: string;
  estado: ChecklistEstado;
  // Solo aplica a Relleno ("la cantidad que le rellenó", texto libre: p.ej.
  // "2 litros") y a Cambio ("el número de piezas", p.ej. "4"). Lubricación y
  // Buen estado no la usan.
  cantidad?: string;
  // Descripción opcional, disponible en cualquier ítem que no quede en "Buen
  // estado" (ver checklistAllowsDescripcion). Para el ítem "Otro" es donde se
  // anota qué se hizo, ya que no viene de la lista fija.
  descripcion?: string;
}

// Ítem especial para lo que no aparece en la lista fija: la pieza/parte real
// se anota en la descripción, pero en el gráfico siempre se agrupa como
// "Otro" (no por el texto libre), para no diluir el top de piezas con
// entradas de un solo uso.
export const OTHER_CHECKLIST_ITEM = "Otro";

// "Buen estado" es el único estado que NO se documenta como pieza.
export function isChecklistDocumentable(estado: ChecklistEstado): boolean {
  return estado !== "Buen estado";
}

// Solo Relleno y Cambio piden una cantidad; Lubricación no.
export function checklistRequiresCantidad(estado: ChecklistEstado): boolean {
  return estado === "Relleno" || estado === "Cambio";
}

export function checklistCantidadLabel(estado: ChecklistEstado): string {
  return estado === "Cambio" ? "Número de piezas" : "Cantidad";
}

// Cualquier ítem que no quede en "Buen estado" admite una descripción
// opcional aparte de la descripción general del mantenimiento.
export function checklistAllowsDescripcion(estado: ChecklistEstado): boolean {
  return estado !== "Buen estado";
}

// Categoría con la que se documentan las piezas que salieron del checklist:
// no vienen del catálogo general de piezas por sistema (lib/piece-catalog.ts)
// sino de este checklist fijo de mantenimiento preventivo, así que se
// agrupan aparte en el gráfico.
export const CHECKLIST_PIECE_CATEGORY = "Servicio preventivo";

const checklistEntrySchema = z.object({
  item: z.string().refine((v) => (PREVENTIVE_CHECKLIST_ITEMS as readonly string[]).includes(v)),
  estado: checklistEstadoSchema,
  cantidad: z.string().max(50).optional(),
  descripcion: z.string().max(500).optional(),
});

// Valida y parsea el JSON que manda el formulario (ver
// components/admin/CreateMaintenanceLogForm.tsx). Devuelve null si el texto
// no es un checklist válido, para que el llamador decida si lo ignora.
export function parseChecklistPreventivo(raw: string | null | undefined): ChecklistEntry[] | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    const parsed = z.array(checklistEntrySchema).safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
