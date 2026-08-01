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
