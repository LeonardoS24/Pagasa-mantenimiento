import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

// Documentos que se suben dentro de cada registro de una unidad (estación o
// planta incluidas: también son VehicleRecord, ver CLAUDE.md), juntos en un
// solo listado por ciudad para poder elegir cuáles descargar (ver
// app/(protected)/ciudades/[citySlug]/documentos-de-pruebas). Cada documento
// cuelga de UNA bitácora o de la unidad directamente (ver
// ownerKeyForDocument en lib/documents.ts); de ahí sale su tipo.

export {
  TIPOS_DOCUMENTO_PRUEBA,
  tipoDocumentoPruebaLabel,
  type TipoDocumentoPrueba,
  type DocumentoPrueba,
} from "./test-document-tipos";
import type { TipoDocumentoPrueba, DocumentoPrueba } from "./test-document-tipos";

const documentInclude = {
  section: { select: { name: true, city: { select: { slug: true, name: true } } } },
  vehicleRecord: {
    select: { id: true, numeroEconomico: true, activo: true, section: { select: { name: true, city: { select: { slug: true, name: true } } } } },
  },
  ultrasoundLog: { select: { fechaRealizacion: true, vehicleRecord: { select: { id: true } } } },
  visualInspectionLog: { select: { fechaRealizacion: true, vehicleRecord: { select: { id: true } } } },
  tightnessTestLog: { select: { fechaRealizacion: true, vehicleRecord: { select: { id: true } } } },
  internalVisualInspectionLog: { select: { fechaRealizacion: true, vehicleRecord: { select: { id: true } } } },
  hydrostaticTestLog: { select: { fechaRealizacion: true, vehicleRecord: { select: { id: true } } } },
  valveChangeLog: { select: { fechaInstalacion: true, vehicleRecord: { select: { id: true } } } },
  valveCorrectiveMaintenanceLog: { select: { fecha: true, vehicleRecord: { select: { id: true } } } },
  hoseChangeLog: { select: { fechaInstalacion: true, vehicleRecord: { select: { id: true } } } },
  extinguisherChangeLog: { select: { fechaRealizacion: true, vehicleRecord: { select: { id: true } } } },
  insurancePolicyLog: { select: { fechaRealizacion: true, vehicleRecord: { select: { id: true } } } },
  maintenanceLog: { select: { fecha: true, vehicleRecord: { select: { id: true } } } },
} satisfies Prisma.DocumentInclude;

type DocumentoConRelaciones = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

// Mismo orden de prioridad que ownerKeyForDocument.
function clasificar(doc: DocumentoConRelaciones): { tipo: TipoDocumentoPrueba; fecha: Date | null; vehicleId: string | null } {
  if (doc.maintenanceLog) return { tipo: "MANTENIMIENTO", fecha: doc.maintenanceLog.fecha, vehicleId: doc.maintenanceLog.vehicleRecord.id };
  if (doc.ultrasoundLog) return { tipo: "ULTRASONIDO", fecha: doc.ultrasoundLog.fechaRealizacion, vehicleId: doc.ultrasoundLog.vehicleRecord.id };
  if (doc.visualInspectionLog) return { tipo: "VISUAL_EXTERNA", fecha: doc.visualInspectionLog.fechaRealizacion, vehicleId: doc.visualInspectionLog.vehicleRecord.id };
  if (doc.tightnessTestLog) return { tipo: "HERMETICIDAD", fecha: doc.tightnessTestLog.fechaRealizacion, vehicleId: doc.tightnessTestLog.vehicleRecord.id };
  if (doc.internalVisualInspectionLog) return { tipo: "VISUAL_INTERNA", fecha: doc.internalVisualInspectionLog.fechaRealizacion, vehicleId: doc.internalVisualInspectionLog.vehicleRecord.id };
  if (doc.hydrostaticTestLog) return { tipo: "HIDROSTATICA", fecha: doc.hydrostaticTestLog.fechaRealizacion, vehicleId: doc.hydrostaticTestLog.vehicleRecord.id };
  if (doc.insurancePolicyLog) return { tipo: "POLIZA", fecha: doc.insurancePolicyLog.fechaRealizacion, vehicleId: doc.insurancePolicyLog.vehicleRecord.id };
  if (doc.extinguisherChangeLog) return { tipo: "EXTINTOR", fecha: doc.extinguisherChangeLog.fechaRealizacion, vehicleId: doc.extinguisherChangeLog.vehicleRecord.id };
  if (doc.valveChangeLog) return { tipo: "VALVULAS", fecha: doc.valveChangeLog.fechaInstalacion, vehicleId: doc.valveChangeLog.vehicleRecord.id };
  if (doc.valveCorrectiveMaintenanceLog) return { tipo: "VALVULAS_CORRECTIVO", fecha: doc.valveCorrectiveMaintenanceLog.fecha, vehicleId: doc.valveCorrectiveMaintenanceLog.vehicleRecord.id };
  if (doc.hoseChangeLog) return { tipo: "MANGUERAS", fecha: doc.hoseChangeLog.fechaInstalacion, vehicleId: doc.hoseChangeLog.vehicleRecord.id };
  return { tipo: "UNIDAD", fecha: doc.kind === "PERMISO" ? doc.fecha : null, vehicleId: doc.vehicleRecordId };
}

// Un documento de bitácora no siempre trae vehicleRecordId lleno (lo trae
// su bitácora): se filtra por cualquiera de los dos caminos.
function whereDocumentosDeUnidades(cityIds: string[]): Prisma.DocumentWhereInput {
  return {
    section: { cityId: { in: cityIds } },
    equipoId: null,
    equipmentLogId: null,
    OR: [
      { vehicleRecordId: { not: null } },
      { ultrasoundLogId: { not: null } },
      { visualInspectionLogId: { not: null } },
      { tightnessTestLogId: { not: null } },
      { internalVisualInspectionLogId: { not: null } },
      { hydrostaticTestLogId: { not: null } },
      { valveChangeLogId: { not: null } },
      { valveCorrectiveMaintenanceLogId: { not: null } },
      { hoseChangeLogId: { not: null } },
      { extinguisherChangeLogId: { not: null } },
      { insurancePolicyLogId: { not: null } },
      { maintenanceLogId: { not: null } },
    ],
  };
}

export async function getDocumentosDePruebas(cityIds: string[]): Promise<DocumentoPrueba[]> {
  if (cityIds.length === 0) return [];
  const docs = await prisma.document.findMany({
    where: whereDocumentosDeUnidades(cityIds),
    include: documentInclude,
    orderBy: { createdAt: "desc" },
  });

  // La unidad de cada documento de bitácora se busca aparte, de un jalón,
  // porque la bitácora solo trae su id.
  const clasificados = docs.map((doc) => ({ doc, ...clasificar(doc) }));
  const idsUnidad = [...new Set(clasificados.map((c) => c.vehicleId).filter((id): id is string => !!id))];
  const unidades = await prisma.vehicleRecord.findMany({
    where: { id: { in: idsUnidad } },
    select: { id: true, numeroEconomico: true, activo: true, section: { select: { name: true, city: { select: { slug: true, name: true } } } } },
  });
  const unidadPorId = new Map(unidades.map((u) => [u.id, u]));

  const resultado: DocumentoPrueba[] = [];
  for (const { doc, tipo, fecha, vehicleId } of clasificados) {
    const unidad = vehicleId ? unidadPorId.get(vehicleId) : undefined;
    if (!unidad) continue;
    resultado.push({
      id: doc.id,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      size: doc.size,
      subidoEl: doc.createdAt.toISOString(),
      fechaEvento: fecha ? fecha.toISOString() : null,
      tipo,
      vehicleId: unidad.id,
      numeroEconomico: unidad.numeroEconomico,
      activo: unidad.activo,
      apartado: unidad.section.name,
      citySlug: unidad.section.city.slug,
      cityName: unidad.section.city.name,
    });
  }
  return resultado;
}

// Para el ZIP: los mismos documentos, pero solo los ids pedidos y solo si
// pertenecen a las ciudades permitidas (los ids llegan del navegador).
export async function getDocumentosDePruebasPorIds(cityIds: string[], ids: string[]): Promise<
  (DocumentoPrueba & { owner: DocumentoConRelaciones })[]
> {
  if (cityIds.length === 0 || ids.length === 0) return [];
  const todos = await getDocumentosDePruebas(cityIds);
  const pedidos = new Set(ids);
  const elegidos = todos.filter((d) => pedidos.has(d.id));
  const owners = await prisma.document.findMany({
    where: { id: { in: elegidos.map((d) => d.id) } },
    include: documentInclude,
  });
  const ownerPorId = new Map(owners.map((o) => [o.id, o]));
  return elegidos.map((d) => ({ ...d, owner: ownerPorId.get(d.id)! })).filter((d) => d.owner);
}
