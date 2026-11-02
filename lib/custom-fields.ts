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

export const CAMPO_TIPOS = ["TEXTO", "TEXTO_LARGO", "NUMERO", "FECHA", "LISTA"] as const;
export type CampoTipo = (typeof CAMPO_TIPOS)[number];

export const campoTipoLabels: Record<CampoTipo, string> = {
  TEXTO: "Texto",
  TEXTO_LARGO: "Texto largo (varias líneas)",
  NUMERO: "Número",
  FECHA: "Fecha",
  LISTA: "Listado para selección",
};

// Las opciones de un campo "LISTA" se guardan como texto, una por línea (ver
// CustomField.opciones en el schema) — más simple de escribir y editar a
// mano en un <textarea> que JSON. parseOpcionesTexto limpia líneas vacías y
// duplicados (sin importar mayúsculas/minúsculas) antes de guardar o de
// armar el <select>.
export function parseOpcionesTexto(texto: string | null | undefined): string[] {
  if (!texto) return [];
  const vistas = new Set<string>();
  const resultado: string[] = [];
  for (const linea of texto.split("\n")) {
    const limpia = linea.trim();
    if (!limpia) continue;
    const clave = limpia.toLowerCase();
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    resultado.push(limpia);
  }
  return resultado;
}

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

export function labelDeSeccion(ambito: CampoAmbito, seccionId: string, propias: readonly CustomSectionDef[] = []): string {
  if (esSeccionPropia(seccionId)) {
    return propias.find((s) => s.id === idDeSeccionPropia(seccionId))?.titulo ?? "Recuadro nuevo";
  }
  return seccionesPara(ambito).find((s) => s.id === seccionId)?.label ?? seccionId;
}

// Recuadros que el ADMIN crea (CustomSection): en CustomField.seccion se
// guardan como "x:<id>" para no confundirse con los de fábrica de arriba.
const PREFIJO_SECCION_PROPIA = "x:";
export const esSeccionPropia = (seccion: string): boolean => seccion.startsWith(PREFIJO_SECCION_PROPIA);
export const idDeSeccionPropia = (seccion: string): string => seccion.slice(PREFIJO_SECCION_PROPIA.length);
export const seccionDePropia = (id: string): string => `${PREFIJO_SECCION_PROPIA}${id}`;

export interface CustomSectionDef {
  id: string;
  ambito: CampoAmbito;
  // null = se ve en todos los apartados de ese ámbito
  apartadoSlug: string | null;
  titulo: string;
  orden: number;
}

// Apartados a los que se puede dirigir un campo o un recuadro nuevo. El slug
// es el del apartado en la base (ver Section.slug).
export const CAMPO_APARTADOS: Record<CampoAmbito, readonly { slug: string; label: string }[]> = {
  VEHICULO: [
    { slug: "auto-tanques", label: "Auto-Tanques" },
    { slug: "semirremolques", label: "Semirremolques" },
    { slug: "tractocamiones", label: "Tractocamiones" },
    { slug: "vehiculo-de-reparto", label: "Vehículo de reparto" },
    { slug: "vehiculo-con-tanque-de-carburacion", label: "Vehículo con tanque de carburación" },
    { slug: "unidades-utilitarias", label: "Unidades utilitarias" },
  ],
  ESTACION: [
    { slug: "estaciones-de-carburacion", label: "Estaciones de carburación" },
    { slug: "planta-ficha-tecnica", label: "Planta" },
  ],
};

export function labelDeApartado(ambito: CampoAmbito, apartadoSlug: string | null | undefined): string {
  if (!apartadoSlug) return "Todos los apartados";
  return CAMPO_APARTADOS[ambito].find((a) => a.slug === apartadoSlug)?.label ?? apartadoSlug;
}

// ¿Este campo o recuadro se ve en el apartado de la unidad? Sin apartado
// (null) se ve en todos; si no se sabe el de la unidad, también.
export function aplicaAApartado(apartadoSlug: string | null | undefined, apartadoDeLaUnidad: string | null | undefined): boolean {
  return !apartadoSlug || !apartadoDeLaUnidad || apartadoSlug === apartadoDeLaUnidad;
}

export interface CustomFieldDef {
  id: string;
  ambito: CampoAmbito;
  seccion: string;
  // null/ausente = en todos los apartados
  apartadoSlug?: string | null;
  etiqueta: string;
  tipo: CampoTipo;
  orden: number;
  // Solo presente cuando tipo === "LISTA" (ver parseOpcionesTexto arriba).
  opciones?: string[];
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
