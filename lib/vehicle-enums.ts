import { z } from "zod";

export const combustibleSchema = z.enum(["GAS_LP", "GASOLINA", "DIESEL", "ELECTRICA"]);
export type Combustible = z.infer<typeof combustibleSchema>;

export const combustibleLabels: Record<Combustible, string> = {
  GAS_LP: "Gas LP",
  GASOLINA: "Gasolina",
  DIESEL: "Diesel",
  ELECTRICA: "Energía eléctrica",
};

export const maintenanceStatusSchema = z.enum([
  "SIN_ATENCION",
  "EN_PROCESO",
  "TERMINADO",
  "CANCELADO",
]);
export type MaintenanceStatus = z.infer<typeof maintenanceStatusSchema>;

export const maintenanceStatusLabels: Record<MaintenanceStatus, string> = {
  SIN_ATENCION: "Sin atención",
  EN_PROCESO: "En proceso",
  TERMINADO: "Terminado",
  CANCELADO: "Cancelado",
};

export const maintenanceStatusStyles: Record<MaintenanceStatus, string> = {
  SIN_ATENCION: "bg-gray-100 text-gray-700",
  EN_PROCESO: "bg-accent-light/20 text-accent",
  TERMINADO: "bg-green-100 text-green-700",
  CANCELADO: "bg-blue-100 text-blue-700",
};
