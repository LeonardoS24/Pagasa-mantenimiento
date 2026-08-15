import { z } from "zod";

export const combustibleSchema = z.enum([
  "GAS_LP",
  "GASOLINA",
  "DIESEL",
  "ELECTRICA",
  "GAS_LP_GASOLINA",
]);
export type Combustible = z.infer<typeof combustibleSchema>;

export const combustibleLabels: Record<Combustible, string> = {
  GAS_LP: "Gas LP",
  GASOLINA: "Gasolina",
  DIESEL: "Diesel",
  ELECTRICA: "Energía eléctrica",
  GAS_LP_GASOLINA: "Gas LP/Gasolina",
};

// El valor almacenado es el mismo texto que se muestra (igual que
// tipoServicio, que es texto libre): así no hace falta un mapa de etiquetas
// en cada lugar donde ya se imprime tipoMantenimiento tal cual.
export const maintenanceTypeSchema = z.enum(["Preventivo", "Correctivo", "Predictivo"]);
export type MaintenanceType = z.infer<typeof maintenanceTypeSchema>;
export const maintenanceTypeOptions = maintenanceTypeSchema.options;

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

// Estatus operativo de la unidad (VehicleRecord.estatus), no confundir con
// MaintenanceStatus de arriba (el estatus de UN mantenimiento en concreto):
// este es el estatus de la unidad completa, ver el comentario del campo en
// prisma/schema.prisma.
export const vehicleEstatusSchema = z.enum(["OPERATIVA", "EN_TALLER", "FUERA_DE_SERVICIO"]);
export type VehicleEstatus = z.infer<typeof vehicleEstatusSchema>;

export const vehicleEstatusLabels: Record<VehicleEstatus, string> = {
  OPERATIVA: "Operativa",
  EN_TALLER: "En taller",
  FUERA_DE_SERVICIO: "Fuera de servicio",
};

export const vehicleEstatusStyles: Record<VehicleEstatus, string> = {
  OPERATIVA: "bg-green-100 text-green-700",
  EN_TALLER: "bg-accent-light/20 text-accent",
  FUERA_DE_SERVICIO: "bg-gray-200 text-gray-700",
};

// A qué estatus se puede pasar A MANO desde cada estatus (ver
// setVehicleEstatus en actions/vehicle-actions.ts y el select rápido del
// listado, components/city/VehicleEstatusControl.tsx). "En taller" nunca se
// elige a mano estando Operativa: a taller se entra sola al registrar un
// mantenimiento sin terminar (ver recalcularFichaTecnicaMantenimiento en
// actions/maintenance-actions.ts), no apretando un botón.
export const vehicleEstatusTransitions: Record<VehicleEstatus, VehicleEstatus[]> = {
  OPERATIVA: ["FUERA_DE_SERVICIO"],
  EN_TALLER: ["OPERATIVA"],
  FUERA_DE_SERVICIO: ["EN_TALLER"],
};

export function canTransitionVehicleEstatus(from: VehicleEstatus, to: VehicleEstatus): boolean {
  // Volver a elegir el estatus en el que ya está no es un cambio: se permite
  // sin más (el select del listado arranca en el actual).
  if (from === to) return true;
  return vehicleEstatusTransitions[from].includes(to);
}

export const calidadExtintorSchema = z.enum(["EXCELENTE", "BUENA", "MALA"]);
export type CalidadExtintor = z.infer<typeof calidadExtintorSchema>;

export const calidadExtintorLabels: Record<CalidadExtintor, string> = {
  EXCELENTE: "Excelente",
  BUENA: "Buena",
  MALA: "Mala",
};

// Calidad general de la unidad, capturada en cada mantenimiento (ver
// MaintenanceLog.calidad) y usada para recalcular VehicleRecord.calidad
// (el registro con la fecha más cercana a hoy, mismo patrón que el
// kilometraje/fechas de la ficha técnica — ver actions/maintenance-actions.ts).
// Distinta de calidadExtintor: esta califica la unidad completa, no solo el
// extintor, y tiene un nivel intermedio (MEDIA) que ese enum no tiene.
export const calidadMantenimientoSchema = z.enum(["EXCELENTE", "BUENA", "MEDIA", "MALA"]);
export type CalidadMantenimiento = z.infer<typeof calidadMantenimientoSchema>;
export const calidadMantenimientoOptions = calidadMantenimientoSchema.options;

export const calidadMantenimientoLabels: Record<CalidadMantenimiento, string> = {
  EXCELENTE: "Excelente",
  BUENA: "Buena",
  MEDIA: "Media",
  MALA: "Mala",
};

export const calidadMantenimientoStyles: Record<CalidadMantenimiento, string> = {
  EXCELENTE: "bg-green-100 text-green-700",
  BUENA: "bg-emerald-100 text-emerald-700",
  MEDIA: "bg-amber-100 text-amber-700",
  MALA: "bg-red-100 text-red-700",
};
