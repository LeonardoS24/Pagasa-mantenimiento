import { z } from "zod";

// El usuario pidió un solo tipo para "electrónicos y eléctricos" (un motor,
// un PLC, un tablero y un sensor comparten la misma ficha técnica), así que
// son 3 tipos en total, no 4.
export const tipoEquipoSchema = z.enum(["MECANICO", "ELECTRICO", "AUXILIAR"]);
export type TipoEquipo = z.infer<typeof tipoEquipoSchema>;

export const tipoEquipoLabels: Record<TipoEquipo, string> = {
  MECANICO: "Mecánico",
  ELECTRICO: "Eléctrico y electrónico",
  AUXILIAR: "Auxiliar",
};

export const estadoEquipoSchema = z.enum(["OPERATIVO", "FUERA_DE_SERVICIO", "MANTENIMIENTO"]);
export type EstadoEquipo = z.infer<typeof estadoEquipoSchema>;

export const estadoEquipoLabels: Record<EstadoEquipo, string> = {
  OPERATIVO: "Operativo",
  FUERA_DE_SERVICIO: "Fuera de servicio",
  MANTENIMIENTO: "Mantenimiento",
};

export const estadoEquipoStyles: Record<EstadoEquipo, string> = {
  OPERATIVO: "bg-green-100 text-green-700",
  FUERA_DE_SERVICIO: "bg-red-100 text-red-700",
  MANTENIMIENTO: "bg-accent-light/20 text-accent",
};

export const criticidadEquipoSchema = z.enum(["ALTA", "MEDIA", "BAJA"]);
export type CriticidadEquipo = z.infer<typeof criticidadEquipoSchema>;

export const criticidadEquipoLabels: Record<CriticidadEquipo, string> = {
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

export const criticidadEquipoStyles: Record<CriticidadEquipo, string> = {
  ALTA: "bg-red-100 text-red-700",
  MEDIA: "bg-amber-100 text-amber-700",
  BAJA: "bg-gray-100 text-gray-700",
};

// Tipo de mantenimiento para la bitácora de un Equipo: los mismos 3 que usan
// las unidades (Preventivo/Correctivo/Predictivo) más "Cambio", exclusivo de
// equipos. "Cambio" no es un mantenimiento normal: da de baja el equipo
// actual y abre uno nuevo del mismo tipo en su lugar (ver
// actions/equipment-log-actions.ts) — un vehículo nunca se "cambia" así, así
// que este cuarto valor vive aparte de maintenanceTypeSchema (lib/vehicle-enums.ts).
export const equipmentLogTipoSchema = z.enum(["Preventivo", "Correctivo", "Predictivo", "Cambio"]);
export type EquipmentLogTipo = z.infer<typeof equipmentLogTipoSchema>;
export const equipmentLogTipoOptions = equipmentLogTipoSchema.options;
