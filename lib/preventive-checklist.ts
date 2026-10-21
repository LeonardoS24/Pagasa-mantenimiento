import { z } from "zod";

// Checklists fijos que se llenan cuando el tipo de mantenimiento es
// "Preventivo" (ver components/admin/CreateMaintenanceLogForm.tsx). Son de
// INGENIERÍA DE GAS, no de mecánica automotriz (aceite, frenos, llantas...):
// a petición del usuario se quitó todo lo mecánico. Hay uno por tipo de
// unidad, porque cada una tiene un sistema de gas distinto (ver
// checklistListaDeApartado). Un ADMIN les agrega ítems desde /admin/piezas
// (ver lib/checklist-runtime.ts).
//
// En todos, cada ítem se revisa de una de dos formas: los que "solo se
// revisan por fugas" (Buen estado / Con fugas) y el resto (Buen estado /
// Reparación / Sustitución). Todo lo que no queda en "Buen estado" se
// documenta como su propio registro de pieza (ver
// actions/maintenance-actions.ts).
export const CHECKLIST_LISTAS = ["TANQUE_CARGA", "REPARTO", "GENERAL", "CARBURACION"] as const;
export type ChecklistLista = (typeof CHECKLIST_LISTAS)[number];

export const checklistListaLabels: Record<ChecklistLista, string> = {
  TANQUE_CARGA: "Auto-Tanques y Semirremolques",
  REPARTO: "Vehículo de reparto",
  GENERAL: "Unidades utilitarias y tractocamiones",
  CARBURACION: "Vehículo con tanque de carburación",
};

export function checklistListaDeApartado(sectionSlug: string): ChecklistLista {
  if (sectionSlug === "vehiculo-con-tanque-de-carburacion") return "CARBURACION";
  if (sectionSlug === "auto-tanques" || sectionSlug === "semirremolques") return "TANQUE_CARGA";
  if (sectionSlug === "vehiculo-de-reparto") return "REPARTO";
  return "GENERAL";
}

// Ítem especial para lo que no aparece en la lista fija: la pieza/parte real
// se anota en la descripción, pero en el gráfico siempre se agrupa como
// "Otro" (no por el texto libre), para no diluir el top de piezas con
// entradas de un solo uso.
export const OTHER_CHECKLIST_ITEM = "Otro";

// Tanque de carga (Auto-Tanques y Semirremolques).
export const TANQUE_CARGA_LEAK_CHECK_ITEMS = [
  "Válvulas del recipiente",
  "Registro pasa hombre",
  "Bridas y empaques",
  "Tubería y conexiones",
  "Manguera de descarga",
  "Acoplador de líquido",
] as const;

export const TANQUE_CARGA_ACCION_ITEMS = [
  "Bomba",
  "Toma de fuerza",
  "Carrete y motor de carrete",
  "Medidor y registro electrónico",
  "Manómetro",
  "Termómetro",
  "Indicador de nivel (Magnatel)",
  "Filtro de gas",
  "Cinta estática (tierra)",
  "Extintor",
  "Letreros y rombos de identificación",
] as const;

export const TANQUE_CARGA_CHECKLIST_ITEMS = [
  ...TANQUE_CARGA_LEAK_CHECK_ITEMS,
  ...TANQUE_CARGA_ACCION_ITEMS,
  OTHER_CHECKLIST_ITEM,
] as const;

// Vehículo de reparto (transporta cilindros).
export const REPARTO_LEAK_CHECK_ITEMS = ["Cilindros transportados (sin fugas ni daños)"] as const;

export const REPARTO_ACCION_ITEMS = [
  "Jaula o redilas",
  "Sujeción de cilindros",
  "Piso de la plataforma",
  "Extintor",
  "Letreros y rombos de identificación",
] as const;

export const REPARTO_CHECKLIST_ITEMS = [
  ...REPARTO_LEAK_CHECK_ITEMS,
  ...REPARTO_ACCION_ITEMS,
  OTHER_CHECKLIST_ITEM,
] as const;

// Utilitarias y tractocamiones: no llevan sistema de gas propio, así que su
// lista es corta (seguridad); el ADMIN le agrega lo que haga falta.
export const PREVENTIVE_CHECKLIST_ITEMS = [
  "Extintor",
  "Letreros y rombos de identificación",
  OTHER_CHECKLIST_ITEM,
] as const;

// Checklist preventivo propio de Vehículo con tanque de carburación: solo lo
// relacionado a su sistema de gas LP. Las válvulas, la manguera y las uniones
// solo se revisan por fugas; el resto de las piezas del kit sí admite reparar
// o sustituir (ver lib/piece-catalog.ts: mismos nombres que las categorías
// "Válvulas" y "Sistema de carburación", salvo "Uniones", que no es una
// pieza que se compre/reemplace por separado).
export const CARBURACION_LEAK_CHECK_ITEMS = [
  "Válvula de llenado (doble check)",
  "Válvula de máximo llenado 90%",
  "Válvula de servicio",
  "Válvula de alivio (seguridad)",
  "Manguera de alta presión",
  "Uniones",
] as const;

export const CARBURACION_ACCION_ITEMS = [
  "Filtro de gas L.P.",
  "Electroválvula",
  "Evaporador",
  "Mezclador",
  "Interruptor (Switch) gas LP/Gasolina",
] as const;

export const CARBURACION_CHECKLIST_ITEMS = [
  ...CARBURACION_LEAK_CHECK_ITEMS,
  ...CARBURACION_ACCION_ITEMS,
] as const;

export type CarburacionChecklistItem = (typeof CARBURACION_CHECKLIST_ITEMS)[number];

export const CHECKLIST_BASE: Record<ChecklistLista, readonly string[]> = {
  TANQUE_CARGA: TANQUE_CARGA_CHECKLIST_ITEMS,
  REPARTO: REPARTO_CHECKLIST_ITEMS,
  GENERAL: PREVENTIVE_CHECKLIST_ITEMS,
  CARBURACION: CARBURACION_CHECKLIST_ITEMS,
};

export const LEAK_CHECK_BASE: Record<ChecklistLista, readonly string[]> = {
  TANQUE_CARGA: TANQUE_CARGA_LEAK_CHECK_ITEMS,
  REPARTO: REPARTO_LEAK_CHECK_ITEMS,
  GENERAL: [],
  CARBURACION: CARBURACION_LEAK_CHECK_ITEMS,
};

// Nombres que tenían antes las válvulas (ver lib/ficha-campos.ts): un
// checklist guardado con ellos se sigue reconociendo como revisión de fugas.
const NOMBRES_ANTERIORES_FUGAS = [
  "Válvula de llenado (Doble check)",
  "Válvula de máximo llenado (purgador)",
  "Válvula de servicio (reguladora)",
  "Válvula de seguridad",
];

export function isLeakCheckItem(item: string): boolean {
  return Object.values(LEAK_CHECK_BASE).some((lista) => lista.includes(item)) || NOMBRES_ANTERIORES_FUGAS.includes(item);
}

// Todos los estados que se han usado. "Relleno", "Lubricación" y "Cambio"
// eran del checklist mecánico anterior: ya no se ofrecen, pero siguen siendo
// válidos para que los mantenimientos viejos guardados con ellos se lean
// igual (todos los checklists se guardan en el mismo campo JSON,
// MaintenanceLog.checklistPreventivo).
export const checklistEstadoSchema = z.enum([
  "Buen estado",
  "Relleno",
  "Lubricación",
  "Cambio",
  "Con fugas",
  "Reparación",
  "Sustitución",
]);
export type ChecklistEstado = z.infer<typeof checklistEstadoSchema>;

// Ítems que solo se revisan por fugas.
export const leakCheckEstadoOptions = ["Buen estado", "Con fugas"] as const;
// Resto de los ítems.
export const carburacionAccionEstadoOptions = ["Buen estado", "Reparación", "Sustitución"] as const;

// Qué opciones de estado le corresponden a un ítem (ver
// CreateMaintenanceLogForm.tsx).
export function checklistEstadoOptionsFor(
  item: string,
  // Ítems que solo se revisan por fugas, incluyendo los agregados desde el
  // panel y marcados así (ver lib/checklist-runtime.ts: getLeakCheckItems).
  // Sin esto solo se conocen los de las listas fijas.
  leakCheckItems?: readonly string[]
): readonly string[] {
  const esDeFugas = leakCheckItems ? leakCheckItems.includes(item) : isLeakCheckItem(item);
  return esDeFugas ? leakCheckEstadoOptions : carburacionAccionEstadoOptions;
}

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
  // Antes esto exigía que el ítem estuviera en una de las dos listas fijas.
  // Ya no: un ADMIN puede agregar ítems propios desde el panel (ver
  // lib/checklist-runtime.ts) y con la regla anterior el checklist completo
  // se descartaba al guardar si traía uno de esos. El nombre es solo una
  // etiqueta que se guarda y se muestra, así que basta con acotar el largo.
  item: z.string().min(1).max(120),
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
