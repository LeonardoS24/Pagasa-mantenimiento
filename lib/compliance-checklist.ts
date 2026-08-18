// Checklist de cumplimiento de normatividad: una lista fija de documentos por
// ámbito (Vehículos, Estaciones, Planta — cada uno con la suya, no editable
// desde el panel, a diferencia de los checklists de mantenimiento). El
// medidor de cumplimiento es simplemente qué porcentaje de esa lista está
// marcado como "cumple" (ver ComplianceChecklistItem en el schema).
export const COMPLIANCE_AMBITOS = ["UNIDAD", "ESTACION", "PLANTA"] as const;
export type ComplianceAmbito = (typeof COMPLIANCE_AMBITOS)[number];

export const complianceAmbitoLabels: Record<ComplianceAmbito, string> = {
  UNIDAD: "Unidades",
  ESTACION: "Estaciones",
  PLANTA: "Planta",
};

export interface ComplianceItemDef {
  clave: string;
  nombre: string;
}

export const UNIDAD_COMPLIANCE_ITEMS: readonly ComplianceItemDef[] = [
  { clave: "certificado_fabricante_tanque", nombre: "Certificado de fabricante (tanque)" },
  { clave: "dictamen_nom_005_sesg_2010", nombre: "Dictamen NOM-005-SESG-2010" },
  { clave: "dictamen_inicio_operacion", nombre: "Dictamen de inicio de operación" },
  {
    clave: "dictamen_operacion_mantenimiento_nom_em_007_asea",
    nombre: "Dictamen de operación y mantenimiento NOM-EM-007-ASEA",
  },
  { clave: "gps_activo", nombre: "GPS activo" },
  { clave: "informe_revision", nombre: "Informe de revisión" },
  { clave: "tarjeta_circulacion", nombre: "Tarjeta de circulación" },
  { clave: "poliza_seguro", nombre: "Póliza de seguro" },
  { clave: "licencia", nombre: "Licencia" },
  { clave: "constancia_capacitacion", nombre: "Constancia de capacitación o certificado" },
];

// Solo aparece en el checklist cuando la unidad está dada de baja (ver
// complianceItemsFor): "Cuando las unidades se den de baja se debe de
// realizar el reporte de término de operaciones."
export const UNIDAD_BAJA_ITEM: ComplianceItemDef = {
  clave: "reporte_termino_operaciones",
  nombre: "Reporte de término de operaciones",
};

export const ESTACION_COMPLIANCE_ITEMS: readonly ComplianceItemDef[] = [
  { clave: "memoria_tecnica", nombre: "Memoria técnica" },
  { clave: "planos", nombre: "Planos (Civil, Mecánico, Eléctrico, Contra incendios)" },
  { clave: "dictamen_unidad_verificacion", nombre: "Dictamen unidad de verificación" },
];

export const PLANTA_COMPLIANCE_ITEMS: readonly ComplianceItemDef[] = [
  {
    clave: "libro_proyecto",
    nombre: "Libro de proyecto (Memorias, planos, análisis de riesgo, análisis de capa de protección)",
  },
  { clave: "dictamen_diseno", nombre: "Dictamen de diseño" },
  { clave: "expedientes_recipientes_almacenamiento", nombre: "Expedientes de recipientes de almacenamiento" },
  { clave: "informe_pruebas_no_destructivas", nombre: "Informe de pruebas no destructivas" },
  { clave: "certificado_personal_soldador", nombre: "Certificado del personal soldador" },
  { clave: "prearranque_rspa", nombre: "Prearranque (RSPA)" },
  { clave: "dictamen_construccion", nombre: "Dictamen de construcción" },
  { clave: "procedimientos_paro_arranque", nombre: "Procedimientos de paro y arranque" },
  { clave: "protocolo_respuesta_emergencias", nombre: "Protocolo de respuesta a emergencias" },
  { clave: "procedimiento_actividades_alto_riesgo", nombre: "Procedimiento a actividades de alto riesgo" },
  { clave: "programa_anual_capacitacion", nombre: "Programa anual de capacitación" },
  {
    clave: "programa_inspeccion_mantenimiento_contra_incendio",
    nombre: "Programa de inspección, prueba y mantenimiento del sistema contra incendio",
  },
  { clave: "dictamen_operacion_mantenimiento_planta", nombre: "Dictamen de operación y mantenimiento" },
  {
    clave: "dictamen_nom_001_sede_2012",
    nombre: "Dictamen NOM-001-SEDE-2012 (vigencia máxima 5 años)",
  },
];

// vehicle.section.slug ya lo calcula cada página (isEstacionCarburacion,
// isPlanta) — aquí solo se recibe el resultado en vez de volver a derivarlo
// de la cadena de apartados.
export function complianceItemsFor(ambito: ComplianceAmbito, activo: boolean): readonly ComplianceItemDef[] {
  if (ambito === "ESTACION") return ESTACION_COMPLIANCE_ITEMS;
  if (ambito === "PLANTA") return PLANTA_COMPLIANCE_ITEMS;
  return activo ? UNIDAD_COMPLIANCE_ITEMS : [...UNIDAD_COMPLIANCE_ITEMS, UNIDAD_BAJA_ITEM];
}

export function compliancePercentage(
  items: readonly ComplianceItemDef[],
  filas: readonly { clave: string; cumple: boolean }[]
): number {
  if (items.length === 0) return 100;
  const cumplidos = items.filter((item) => filas.find((f) => f.clave === item.clave)?.cumple).length;
  return Math.round((cumplidos / items.length) * 100);
}

export type ComplianceGaugeLevel = "bajo" | "medio" | "alto";

export function complianceGaugeLevel(porcentaje: number): ComplianceGaugeLevel {
  if (porcentaje >= 90) return "alto";
  if (porcentaje >= 60) return "medio";
  return "bajo";
}

export const complianceGaugeColors: Record<ComplianceGaugeLevel, { track: string; text: string }> = {
  alto: { track: "#059669", text: "text-green-700" },
  medio: { track: "#D97706", text: "text-amber-700" },
  bajo: { track: "#DC2626", text: "text-red-700" },
};
