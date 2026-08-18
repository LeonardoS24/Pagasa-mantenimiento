import { prisma } from "@/lib/prisma";
import {
  complianceItemsFor,
  compliancePercentage,
  type ComplianceAmbito,
} from "@/lib/compliance-checklist";

export interface ComplianceOverviewRow {
  ambito: ComplianceAmbito;
  promedio: number;
  total: number;
}

function ambitoDe(sectionSlug: string): ComplianceAmbito {
  if (sectionSlug === "estaciones-de-carburacion") return "ESTACION";
  if (sectionSlug === "planta-ficha-tecnica") return "PLANTA";
  return "UNIDAD";
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
