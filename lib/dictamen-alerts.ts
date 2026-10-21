import { daysUntil } from "./ultrasound-alerts";
import type { ValveAlertLevel } from "./valve-alerts";

// Dictámenes con vigencia de 1 año. En la ficha técnica se guarda la fecha de
// EMISIÓN del último de cada tipo (el PDF va como documento de la unidad) y
// el vencimiento es un año después. Sin estas fechas capturadas no hay alerta.
//
// Fuente (cotejada con los PDF del DOF):
// - Operación y mantenimiento: Auto-Tanques, NOM-EM-009-ASEA-2026, 7.4.1;
//   Semirremolques y Tractocamiones (la Unidad de Transporte), NOM-EM-008-ASEA-2026,
//   7.7.1 y 7.7.5.
// - NOM-068-SCT-2-2014 anual: NOM-EM-008-ASEA-2026, 7.5.3 (Semirremolque,
//   Auto-tanque de transporte y su Tractocamión).
// - Instalación del equipo de carburación: NOM-005-SESH-2010, numeral 13.
// - Estación de carburación: NOM-003-SEDG-2004, procedimiento de evaluación,
//   artículo 5 (cada doce meses).
export type DictamenCampo =
  | "fechaDictamenOperacion"
  | "fechaDictamenNom068"
  | "fechaDictamenInstalacion"
  | "fechaDictamenEstacion";

export type DictamenDef = {
  campo: DictamenCampo;
  nombre: string;
  // Apartados (slug) donde aplica.
  apartados: string[];
  // Dónde lo pide la norma, para mostrarlo junto al campo.
  fundamento: string;
};

export const DICTAMENES: DictamenDef[] = [
  {
    campo: "fechaDictamenOperacion",
    nombre: "Dictamen de operación y mantenimiento",
    apartados: ["auto-tanques", "semirremolques", "tractocamiones"],
    fundamento: "NOM-EM-009 7.4.1 (Auto-Tanques) · NOM-EM-008 7.7.5 (Semirremolques y Tractocamiones): vigencia de 1 año desde su emisión.",
  },
  {
    campo: "fechaDictamenNom068",
    nombre: "Dictamen NOM-068-SCT-2-2014",
    apartados: ["semirremolques", "tractocamiones"],
    fundamento: "NOM-EM-008 7.5.3: dictamen aprobatorio vigente cada año.",
  },
  {
    campo: "fechaDictamenInstalacion",
    nombre: "Dictamen de la instalación de carburación",
    apartados: ["vehiculo-con-tanque-de-carburacion"],
    fundamento: "NOM-005-SESH-2010, numeral 13: vigencia máxima de 1 año desde su emisión.",
  },
  {
    campo: "fechaDictamenEstacion",
    nombre: "Dictamen de la estación",
    apartados: ["estaciones-de-carburacion"],
    fundamento: "NOM-003-SEDG-2004, procedimiento de evaluación, artículo 5: cada doce meses.",
  },
];

export function nombreDictamen(campo: DictamenCampo): string {
  return DICTAMENES.find((d) => d.campo === campo)?.nombre ?? campo;
}

export function dictamenesDeApartado(sectionSlug: string | null | undefined): DictamenDef[] {
  return DICTAMENES.filter((d) => sectionSlug && d.apartados.includes(sectionSlug));
}

function addYears(date: Date, years: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear() + years, date.getUTCMonth(), date.getUTCDate()));
}

export function getDictamenVencimiento(emision: Date | null | undefined): Date | null {
  return emision ? addYears(emision, 1) : null;
}

// Mismos umbrales que el resto de las alertas: rojo a 7 días o menos
// (incluye vencido), amarillo a 30.
export function getDictamenAlertLevel(vencimiento: Date | null | undefined): ValveAlertLevel {
  if (!vencimiento) return "none";
  const dias = daysUntil(vencimiento);
  if (dias <= 7) return "red";
  if (dias <= 30) return "yellow";
  return "none";
}

export type FechasDictamen = Partial<Record<DictamenCampo, Date | null | undefined>>;

// Los dictámenes que le tocan a un apartado y tienen fecha capturada.
export function dictamenesDeFicha(
  sheet: FechasDictamen | null | undefined,
  sectionSlug: string | null | undefined
): { campo: DictamenCampo; nombre: string; emision: Date; vencimiento: Date }[] {
  const lista: { campo: DictamenCampo; nombre: string; emision: Date; vencimiento: Date }[] = [];
  for (const d of dictamenesDeApartado(sectionSlug)) {
    const emision = sheet?.[d.campo];
    if (emision) lista.push({ campo: d.campo, nombre: d.nombre, emision, vencimiento: getDictamenVencimiento(emision)! });
  }
  return lista;
}

export function dictamenAlertMessage(
  level: ValveAlertLevel,
  vencimiento: Date,
  numeroEconomico: string,
  dictamen: string
): string | null {
  if (level === "none") return null;
  const dias = daysUntil(vencimiento);
  if (level === "red") {
    if (dias < 0) return `¡URGENTE! El ${dictamen.toLowerCase()} de "${numeroEconomico}" está VENCIDO desde hace ${Math.abs(dias)} día(s).`;
    if (dias === 0) return `¡URGENTE! El ${dictamen.toLowerCase()} de "${numeroEconomico}" vence HOY.`;
    return `¡URGENTE! Solo falta${dias === 1 ? "" : "n"} ${dias} día(s) para el vencimiento del ${dictamen.toLowerCase()} de "${numeroEconomico}".`;
  }
  return `Atención: falta${dias === 1 ? "" : "n"} ${dias} día(s) para el vencimiento del ${dictamen.toLowerCase()} de "${numeroEconomico}".`;
}

export function dictamenAlertLabel(level: ValveAlertLevel, vencimiento: Date): string {
  if (level === "none") return "";
  const dias = daysUntil(vencimiento);
  if (dias < 0) return `Vencido hace ${Math.abs(dias)} día(s)`;
  if (dias === 0) return "Vence hoy";
  return `Faltan ${dias} día(s)`;
}
