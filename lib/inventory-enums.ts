import { z } from "zod";

export const pieceOrderStatusSchema = z.enum(["PENDIENTE", "ACEPTADA", "RECHAZADA"]);
export type PieceOrderStatus = z.infer<typeof pieceOrderStatusSchema>;

export const pieceOrderStatusLabels: Record<PieceOrderStatus, string> = {
  PENDIENTE: "Pendiente",
  ACEPTADA: "Aceptada",
  RECHAZADA: "Rechazada",
};

export const pieceOrderStatusStyles: Record<PieceOrderStatus, string> = {
  PENDIENTE: "bg-gray-100 text-gray-700",
  ACEPTADA: "bg-green-100 text-green-700",
  RECHAZADA: "bg-red-100 text-red-700",
};

export const inventoryItemStatusSchema = z.enum(["EN_INVENTARIO", "POR_UTILIZAR", "UTILIZADA"]);
export type InventoryItemStatus = z.infer<typeof inventoryItemStatusSchema>;

export const inventoryItemStatusLabels: Record<InventoryItemStatus, string> = {
  EN_INVENTARIO: "En inventario",
  POR_UTILIZAR: "Por utilizar",
  UTILIZADA: "Utilizada",
};

export const inventoryItemStatusStyles: Record<InventoryItemStatus, string> = {
  EN_INVENTARIO: "bg-blue-100 text-blue-700",
  POR_UTILIZAR: "bg-accent-light/30 text-accent",
  UTILIZADA: "bg-gray-200 text-gray-600",
};

export const INVENTORY_POR_UTILIZAR_DAYS = 5;

// Tipo de lo que se ordena. Sustituye al antiguo campo de texto libre
// "pieza": ahora se elige de una lista y la unidad se deduce sola.
export const ordenTipoSchema = z.enum(["REFACCION", "PIEZA", "HERRAMIENTA", "CONSUMIBLE"]);
export type OrdenTipo = z.infer<typeof ordenTipoSchema>;

export const ordenTipoLabels: Record<OrdenTipo, string> = {
  REFACCION: "Refacción",
  PIEZA: "Pieza",
  HERRAMIENTA: "Herramienta",
  CONSUMIBLE: "Consumible",
};

// Unidad ya resuelta que se guarda junto a la cantidad. Los tipos contables
// siempre son piezas; solo el consumible deja elegir entre litros y kilos.
export const ordenUnidadSchema = z.enum(["PZA", "LTS", "KG"]);
export type OrdenUnidad = z.infer<typeof ordenUnidadSchema>;

export const consumibleUnidadSchema = z.enum(["LTS", "KG"]);
export type ConsumibleUnidad = z.infer<typeof consumibleUnidadSchema>;

export const consumibleUnidadLabels: Record<ConsumibleUnidad, string> = {
  LTS: "Litros (lts)",
  KG: "Kilos (kg)",
};

// Los tipos contables se desglosan uno por uno al aceptar la orden; el
// consumible se queda en un solo renglón con el total (20 lts, no 20x1 lt).
export function esContable(tipo: OrdenTipo): boolean {
  return tipo !== "CONSUMIBLE";
}

export function unidadParaTipo(tipo: OrdenTipo, unidadConsumible?: ConsumibleUnidad): OrdenUnidad {
  return tipo === "CONSUMIBLE" ? unidadConsumible ?? "LTS" : "PZA";
}

// "1 pza" / "5 pzas" / "20 lts" / "15 kg"
export function formatCantidad(cantidad: number, unidad: string): string {
  if (unidad === "PZA") return `${cantidad} ${cantidad === 1 ? "pza" : "pzas"}`;
  if (unidad === "KG") return `${cantidad} kg`;
  return `${cantidad} lts`;
}

// Abreviatura de unidad sin cantidad, para prellenar el campo "Unidad" de la
// bitácora de mantenimiento cuando una pieza de inventario se marca
// "Utilizada" (ver actions/inventory-actions.ts).
export function unidadAbreviatura(unidad: string): string {
  if (unidad === "PZA") return "pza";
  if (unidad === "KG") return "kg";
  return "lts";
}

// Etiqueta completa de un renglón: "Balata delantera (Refacción) · 5 pzas"
export function describeOrden(
  tipo: string,
  nombre: string,
  cantidad: number,
  unidad: string
): string {
  const label = ordenTipoLabels[tipo as OrdenTipo] ?? tipo;
  return `${nombre} (${label}) · ${formatCantidad(cantidad, unidad)}`;
}

// El campo de nombre se adapta al tipo elegido para que quede claro qué se
// está pidiendo en cada caso.
export const ordenNombreLabels: Record<OrdenTipo, string> = {
  REFACCION: "Nombre de la refacción",
  PIEZA: "Nombre de la pieza",
  HERRAMIENTA: "Nombre de la herramienta",
  CONSUMIBLE: "Nombre del consumible",
};

export const ordenNombrePlaceholders: Record<OrdenTipo, string> = {
  REFACCION: "Ej. Balata delantera",
  PIEZA: "Ej. Tornillo M8",
  HERRAMIENTA: "Ej. Llave de torque",
  CONSUMIBLE: "Ej. Aceite 15W40",
};
