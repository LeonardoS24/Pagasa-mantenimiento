import { prisma } from "./prisma";

// Qué se lleva por delante un borrado en cascada. Se calcula solo cuando el
// usuario pide confirmar (no al pintar la lista), porque son varias consultas.
export type DeleteImpact = {
  unidades: number;
  equipos: number;
  bitacoras: number;
  documentos: number;
  apartados: number;
  ordenes: number;
  inventario: number;
};

export function impactTotal(impact: DeleteImpact): number {
  return (
    impact.unidades +
    impact.equipos +
    impact.bitacoras +
    impact.documentos +
    impact.ordenes +
    impact.inventario
  );
}

// Frase para la confirmación: "47 unidades, 312 registros de bitácora y 80
// documentos PDF". Omite lo que esté en cero para no llenar de ruido.
export function describeImpact(impact: DeleteImpact): string {
  const partes: string[] = [];
  const agrega = (n: number, singular: string, plural: string) => {
    if (n > 0) partes.push(`${n} ${n === 1 ? singular : plural}`);
  };
  agrega(impact.unidades, "unidad", "unidades");
  agrega(impact.equipos, "equipo", "equipos");
  agrega(impact.bitacoras, "registro de bitácora", "registros de bitácora");
  agrega(impact.documentos, "documento PDF", "documentos PDF");
  agrega(impact.apartados, "apartado", "apartados");
  agrega(impact.ordenes, "orden de pieza", "órdenes de pieza");
  agrega(impact.inventario, "artículo de inventario", "artículos de inventario");

  if (partes.length === 0) return "No contiene información.";
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

// Los 10 tipos de bitácora cuelgan de VehicleRecord. Se cuentan filtrando por
// los apartados involucrados en vez de por vehículo, para no traerlos todos.
async function contarBitacoras(sectionIds: string[]): Promise<number> {
  const where = { vehicleRecord: { sectionId: { in: sectionIds } } };
  const conteos = await Promise.all([
    prisma.maintenanceLog.count({ where }),
    prisma.ultrasoundLog.count({ where }),
    prisma.visualInspectionLog.count({ where }),
    prisma.tightnessTestLog.count({ where }),
    prisma.internalVisualInspectionLog.count({ where }),
    prisma.hydrostaticTestLog.count({ where }),
    prisma.extinguisherChangeLog.count({ where }),
    prisma.valveChangeLog.count({ where }),
    prisma.valveCorrectiveMaintenanceLog.count({ where }),
    prisma.hoseChangeLog.count({ where }),
  ]);
  return conteos.reduce((a, b) => a + b, 0);
}

async function impactoDeApartados(
  sectionIds: string[],
  apartadosContados: number
): Promise<DeleteImpact> {
  if (sectionIds.length === 0) {
    return {
      unidades: 0,
      equipos: 0,
      bitacoras: 0,
      documentos: 0,
      apartados: apartadosContados,
      ordenes: 0,
      inventario: 0,
    };
  }
  const [unidades, equipos, documentos, ordenes, inventario, bitacorasUnidades, bitacorasEquipos] =
    await Promise.all([
      prisma.vehicleRecord.count({ where: { sectionId: { in: sectionIds } } }),
      prisma.equipo.count({ where: { sectionId: { in: sectionIds } } }),
      prisma.document.count({ where: { sectionId: { in: sectionIds } } }),
      prisma.pieceOrder.count({ where: { sectionId: { in: sectionIds } } }),
      prisma.inventoryItem.count({ where: { sectionId: { in: sectionIds } } }),
      contarBitacoras(sectionIds),
      prisma.equipmentLog.count({ where: { equipo: { sectionId: { in: sectionIds } } } }),
    ]);
  return {
    unidades,
    equipos,
    bitacoras: bitacorasUnidades + bitacorasEquipos,
    documentos,
    apartados: apartadosContados,
    ordenes,
    inventario,
  };
}

// Lo que se lleva por delante borrar una sola unidad: su ficha técnica no se
// cuenta (es parte de la unidad), pero sí sus bitácoras y documentos.
export async function getVehicleDeleteImpact(vehicleId: string): Promise<DeleteImpact> {
  const where = { vehicleRecordId: vehicleId };
  const [documentos, bitacoras, equipos] = await Promise.all([
    prisma.document.count({
      where: {
        OR: [
          { vehicleRecordId: vehicleId },
          { maintenanceLog: where },
          { ultrasoundLog: where },
          { visualInspectionLog: where },
          { tightnessTestLog: where },
          { internalVisualInspectionLog: where },
          { hydrostaticTestLog: where },
          { extinguisherChangeLog: where },
          { valveChangeLog: where },
          { valveCorrectiveMaintenanceLog: where },
          { hoseChangeLog: where },
        ],
      },
    }),
    Promise.all([
      prisma.maintenanceLog.count({ where }),
      prisma.ultrasoundLog.count({ where }),
      prisma.visualInspectionLog.count({ where }),
      prisma.tightnessTestLog.count({ where }),
      prisma.internalVisualInspectionLog.count({ where }),
      prisma.hydrostaticTestLog.count({ where }),
      prisma.extinguisherChangeLog.count({ where }),
      prisma.valveChangeLog.count({ where }),
      prisma.valveCorrectiveMaintenanceLog.count({ where }),
      prisma.hoseChangeLog.count({ where }),
    ]).then((c) => c.reduce((a, b) => a + b, 0)),
    // Solo distinto de 0 para una Estación de carburación (ver
    // Equipo.vehicleRecordId): sus equipos propios se van con ella.
    prisma.equipo.count({ where }),
  ]);

  return { unidades: 0, equipos, bitacoras, documentos, apartados: 0, ordenes: 0, inventario: 0 };
}

// Lo que se lleva por delante borrar un solo Equipo: su bitácora y documentos.
export async function getEquipoDeleteImpact(equipoId: string): Promise<DeleteImpact> {
  const [documentos, bitacoras] = await Promise.all([
    prisma.document.count({
      where: { OR: [{ equipoId }, { equipmentLog: { equipoId } }] },
    }),
    prisma.equipmentLog.count({ where: { equipoId } }),
  ]);

  return { unidades: 0, equipos: 0, bitacoras, documentos, apartados: 0, ordenes: 0, inventario: 0 };
}

export async function getCityDeleteImpact(cityId: string): Promise<DeleteImpact> {
  const sections = await prisma.section.findMany({ where: { cityId }, select: { id: true } });
  return impactoDeApartados(sections.map((s) => s.id), sections.length);
}

// Un apartado arrastra a sus sub-apartados, así que hay que recorrer el árbol
// hacia abajo antes de contar (o antes de borrar sus archivos).
export async function getSectionSubtreeIds(sectionId: string): Promise<string[]> {
  const section = await prisma.section.findUnique({ where: { id: sectionId } });
  if (!section) return [];

  const todas = await prisma.section.findMany({
    where: { cityId: section.cityId },
    select: { id: true, parentId: true },
  });

  const ids = [sectionId];
  let frontera = [sectionId];
  while (frontera.length > 0) {
    const hijos = todas.filter((s) => s.parentId && frontera.includes(s.parentId)).map((s) => s.id);
    ids.push(...hijos);
    frontera = hijos;
  }
  return ids;
}

export async function getSectionDeleteImpact(sectionId: string): Promise<DeleteImpact> {
  const ids = await getSectionSubtreeIds(sectionId);
  if (ids.length === 0) {
    return { unidades: 0, equipos: 0, bitacoras: 0, documentos: 0, apartados: 0, ordenes: 0, inventario: 0 };
  }
  // El propio apartado no cuenta como "sub-apartado eliminado".
  return impactoDeApartados(ids, ids.length - 1);
}
