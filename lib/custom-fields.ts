// Campos que un ADMIN agrega a las fichas técnicas desde el panel (ver
// /admin/campos y actions/custom-field-actions.ts). Son "recuadros extra"
// para capturar información que el sistema no contempla de fábrica.
//
// A propósito NO tocan las columnas fijas de VehicleTechnicalSheet ni de
// StationTankTechnicalSheet: sus valores viven en su propia tabla
// (CustomFieldValue). Eso mantiene intactas las alertas, el semáforo, los
// vencimientos y la exportación a Excel, que dependen de esas columnas.

export const CAMPO_AMBITOS = ["VEHICULO", "ESTACION"] as const;
export type CampoAmbito = (typeof CAMPO_AMBITOS)[number];

export const campoAmbitoLabels: Record<CampoAmbito, string> = {
  VEHICULO: "Ficha técnica de unidad",
  ESTACION: "Ficha técnica del tanque (Estación / Planta)",
};

export const CAMPO_TIPOS = ["TEXTO", "TEXTO_LARGO", "NUMERO", "FECHA"] as const;
export type CampoTipo = (typeof CAMPO_TIPOS)[number];

export const campoTipoLabels: Record<CampoTipo, string> = {
  TEXTO: "Texto",
  TEXTO_LARGO: "Texto largo (varias líneas)",
  NUMERO: "Número",
  FECHA: "Fecha",
};

// Recuadros de la ficha técnica donde se puede colocar un campo nuevo. Las
// claves coinciden con SECTION_STYLES (lib/section-colors.ts) para que el
// campo salga del mismo color que el recuadro donde vive.
export const CAMPO_SECCIONES_VEHICULO = [
  { id: "automovil", label: "Automóvil" },
  { id: "tanque", label: "Tanque" },
  { id: "extintor", label: "Extintor" },
  { id: "mantenimiento", label: "Mantenimiento preventivo" },
  { id: "valvulas", label: "Cambio de válvulas" },
  { id: "mangueras", label: "Cambio de mangueras" },
  { id: "ultrasonido", label: "Ultrasonido" },
  { id: "visualExterna", label: "Inspección visual externa" },
  { id: "visualInterna", label: "Inspección visual interna" },
  { id: "hermeticidad", label: "Prueba de hermeticidad" },
  { id: "hidrostatica", label: "Prueba hidrostática" },
] as const;

export const CAMPO_SECCIONES_ESTACION = [
  { id: "tanque", label: "Ficha técnica del tanque" },
  { id: "valvulas", label: "Cambio de válvulas" },
] as const;

export function seccionesPara(ambito: CampoAmbito): readonly { id: string; label: string }[] {
  return ambito === "ESTACION" ? CAMPO_SECCIONES_ESTACION : CAMPO_SECCIONES_VEHICULO;
}

export function labelDeSeccion(ambito: CampoAmbito, seccionId: string): string {
  return seccionesPara(ambito).find((s) => s.id === seccionId)?.label ?? seccionId;
}

export interface CustomFieldDef {
  id: string;
  ambito: CampoAmbito;
  seccion: string;
  etiqueta: string;
  tipo: CampoTipo;
  orden: number;
}

// El nombre del <input> en el formulario. El prefijo evita que un campo
// nuevo choque con una columna fija que se llame igual.
export function campoInputName(fieldId: string): string {
  return `campoExtra_${fieldId}`;
}

export function esCampoExtraInput(name: string): boolean {
  return name.startsWith("campoExtra_");
}

export function fieldIdDesdeInputName(name: string): string {
  return name.slice("campoExtra_".length);
}
