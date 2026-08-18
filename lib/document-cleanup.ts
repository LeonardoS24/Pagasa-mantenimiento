import { prisma } from "./prisma";
import { deleteDocumentFiles } from "./documents";

// Los campos mínimos para saber dónde vive cada archivo en disco.
const camposDeDueno = {
  storedName: true,
  sectionId: true,
  vehicleRecordId: true,
  maintenanceLogId: true,
  ultrasoundLogId: true,
  visualInspectionLogId: true,
  tightnessTestLogId: true,
  internalVisualInspectionLogId: true,
  hydrostaticTestLogId: true,
  extinguisherChangeLogId: true,
  insurancePolicyLogId: true,
  valveChangeLogId: true,
  valveCorrectiveMaintenanceLogId: true,
  hoseChangeLogId: true,
  equipoId: true,
  equipmentLogId: true,
} as const;

// Borra del disco los PDF de una unidad: los suyos y los de sus 10 tipos de
// bitácora, que también se van en la cascada. Hay que llamarla antes de
// borrar la unidad.
export async function deleteVehicleDocumentFiles(vehicleId: string): Promise<void> {
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { vehicleRecordId: vehicleId },
        { maintenanceLog: { vehicleRecordId: vehicleId } },
        { ultrasoundLog: { vehicleRecordId: vehicleId } },
        { visualInspectionLog: { vehicleRecordId: vehicleId } },
        { tightnessTestLog: { vehicleRecordId: vehicleId } },
        { internalVisualInspectionLog: { vehicleRecordId: vehicleId } },
        { hydrostaticTestLog: { vehicleRecordId: vehicleId } },
        { extinguisherChangeLog: { vehicleRecordId: vehicleId } },
        { valveChangeLog: { vehicleRecordId: vehicleId } },
        { valveCorrectiveMaintenanceLog: { vehicleRecordId: vehicleId } },
        { hoseChangeLog: { vehicleRecordId: vehicleId } },
      ],
    },
    select: camposDeDueno,
  });
  await deleteDocumentFiles(documents);
}

// Igual, pero para todo lo que cuelga de una lista de apartados: los
// documentos del apartado, los de sus unidades/equipos y los de las
// bitácoras de esas unidades/equipos. Sirve para borrar una ciudad o un
// apartado.
export async function deleteSectionDocumentFiles(sectionIds: string[]): Promise<void> {
  if (sectionIds.length === 0) return;

  const enEsosApartados = { vehicleRecord: { sectionId: { in: sectionIds } } };
  const equipoEnEsosApartados = { equipo: { sectionId: { in: sectionIds } } };
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { sectionId: { in: sectionIds } },
        { vehicleRecord: { sectionId: { in: sectionIds } } },
        { maintenanceLog: enEsosApartados },
        { ultrasoundLog: enEsosApartados },
        { visualInspectionLog: enEsosApartados },
        { tightnessTestLog: enEsosApartados },
        { internalVisualInspectionLog: enEsosApartados },
        { hydrostaticTestLog: enEsosApartados },
        { extinguisherChangeLog: enEsosApartados },
        { valveChangeLog: enEsosApartados },
        { valveCorrectiveMaintenanceLog: enEsosApartados },
        { hoseChangeLog: enEsosApartados },
        { equipo: { sectionId: { in: sectionIds } } },
        { equipmentLog: equipoEnEsosApartados },
      ],
    },
    select: camposDeDueno,
  });
  await deleteDocumentFiles(documents);
}

// Los documentos de un Equipo y de su bitácora, antes de borrarlo.
export async function deleteEquipoDocumentFiles(equipoId: string): Promise<void> {
  const documents = await prisma.document.findMany({
    where: {
      OR: [{ equipoId }, { equipmentLog: { equipoId } }],
    },
    select: camposDeDueno,
  });
  await deleteDocumentFiles(documents);
}

// Los documentos de una bitácora concreta, antes de borrarla.
export async function deleteLogDocumentFiles(
  campo: keyof typeof camposDeDueno,
  logId: string
): Promise<void> {
  const documents = await prisma.document.findMany({
    where: { [campo]: logId },
    select: camposDeDueno,
  });
  await deleteDocumentFiles(documents);
}
