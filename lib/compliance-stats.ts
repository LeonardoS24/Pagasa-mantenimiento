import { prisma } from "@/lib/prisma";
import {
  complianceItemsFor,
  compliancePercentage,
  complianceAmbitoDe as ambitoDe,
  type ComplianceAmbito,
} from "@/lib/compliance-checklist";

export interface ComplianceOverviewRow {
  ambito: ComplianceAmbito;
  promedio: number;
  total: number;
}

// Promedio del medidor de cumplimiento por ámbito, para el panel de
// Administración (ver components/city/ComplianceOverviewPanel.tsx). Incluye
// también las unidades dadas de baja: su checklist trae un documento extra
// (Reporte de término de operaciones) que precisamente hay que vigilar que
// se complete, así que no tendría sentido dejarlas fuera del promedio.
export async function getComplianceOverview(cityIds: string[]): Promise<ComplianceOverviewRow[]> {
  if (cityIds.length === 0) return [];

  const records = await prisma.vehicleRecord.findMany({
    where: { section: { cityId: { in: cityIds } } },
    select: {
      activo: true,
      section: { select: { slug: true } },
      complianceChecklistItems: { select: { clave: true, cumple: true } },
    },
  });

  const sumas = new Map<ComplianceAmbito, { suma: number; total: number }>();
  for (const record of records) {
    const ambito = ambitoDe(record.section.slug);
    const items = complianceItemsFor(ambito, record.activo);
    const porcentaje = compliancePercentage(items, record.complianceChecklistItems);
    const acc = sumas.get(ambito) ?? { suma: 0, total: 0 };
    acc.suma += porcentaje;
    acc.total += 1;
    sumas.set(ambito, acc);
  }

  const orden: ComplianceAmbito[] = ["UNIDAD", "ESTACION", "PLANTA"];
  return orden
    .filter((ambito) => (sumas.get(ambito)?.total ?? 0) > 0)
    .map((ambito) => {
      const acc = sumas.get(ambito)!;
      return { ambito, promedio: Math.round(acc.suma / acc.total), total: acc.total };
    });
}

export interface ComplianceByUnitRow {
  id: string;
  numeroEconomico: string;
  sectionSlug: string;
  citySlug: string;
  cityName: string;
  ambito: ComplianceAmbito;
  activo: boolean;
  porcentaje: number;
}

// El porcentaje del checklist de cumplimiento normativo, unidad por unidad
// (no solo el promedio del ámbito, ver getComplianceOverview arriba) — para
// el apartado Resumen de Administración, ordenado del más bajo al más alto
// para que lo más urgente aparezca primero. ambitos filtra a cuáles de los
// 3 (UNIDAD/ESTACION/PLANTA) incluir; sin filtro, trae los 3.
export async function getComplianceByUnit(
  cityIds: string[],
  ambitos?: ComplianceAmbito[]
): Promise<ComplianceByUnitRow[]> {
  if (cityIds.length === 0) return [];

  const records = await prisma.vehicleRecord.findMany({
    where: { section: { cityId: { in: cityIds } } },
    select: {
      id: true,
      numeroEconomico: true,
      activo: true,
      section: { select: { slug: true, city: { select: { slug: true, name: true } } } },
      complianceChecklistItems: { select: { clave: true, cumple: true } },
    },
  });

  const filas = records
    .map((record) => {
      const ambito = ambitoDe(record.section.slug);
      const items = complianceItemsFor(ambito, record.activo);
      const porcentaje = compliancePercentage(items, record.complianceChecklistItems);
      return {
        id: record.id,
        numeroEconomico: record.numeroEconomico,
        sectionSlug: record.section.slug,
        citySlug: record.section.city.slug,
        cityName: record.section.city.name,
        ambito,
        activo: record.activo,
        porcentaje,
      };
    })
    .filter((fila) => !ambitos || ambitos.includes(fila.ambito));

  filas.sort((a, b) => a.porcentaje - b.porcentaje || a.numeroEconomico.localeCompare(b.numeroEconomico, "es"));
  return filas;
}
