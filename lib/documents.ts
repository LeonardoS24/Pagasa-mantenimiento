import { randomUUID } from "crypto";
import path from "path";
import fs from "fs/promises";

export const UPLOADS_DIR = path.join(process.cwd(), "uploads");
export const MAX_DOCUMENT_SIZE = 20 * 1024 * 1024; // 20 MB

// `ownerKey` es la subcarpeta donde se guardan los archivos de un dueño dado:
// el id de un Section para documentos de apartado, o `vehicles/{vehicleRecordId}`
// para documentos de una unidad específica.
export function storagePathFor(ownerKey: string, storedName: string): string {
  return path.join(UPLOADS_DIR, ownerKey, storedName);
}

export async function saveDocumentFile(
  ownerKey: string,
  file: File
): Promise<{ storedName: string }> {
  const extension = path.extname(file.name) || ".pdf";
  const storedName = `${randomUUID()}${extension}`;

  const dir = path.join(UPLOADS_DIR, ownerKey);
  await fs.mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(dir, storedName), buffer);

  return { storedName };
}

export async function deleteDocumentFile(ownerKey: string, storedName: string): Promise<void> {
  try {
    await fs.unlink(storagePathFor(ownerKey, storedName));
  } catch {
    // El archivo ya no existe en disco; no es un error para el usuario.
  }
}

export function vehicleOwnerKey(vehicleRecordId: string): string {
  return path.posix.join("vehicles", vehicleRecordId);
}

export function maintenanceLogOwnerKey(maintenanceLogId: string): string {
  return path.posix.join("maintenance-logs", maintenanceLogId);
}

export function ultrasoundLogOwnerKey(ultrasoundLogId: string): string {
  return path.posix.join("ultrasound-logs", ultrasoundLogId);
}

export function visualInspectionLogOwnerKey(visualInspectionLogId: string): string {
  return path.posix.join("visual-inspection-logs", visualInspectionLogId);
}

export function tightnessTestLogOwnerKey(tightnessTestLogId: string): string {
  return path.posix.join("tightness-test-logs", tightnessTestLogId);
}

export function internalVisualInspectionLogOwnerKey(internalVisualInspectionLogId: string): string {
  return path.posix.join("internal-visual-inspection-logs", internalVisualInspectionLogId);
}

export function hydrostaticTestLogOwnerKey(hydrostaticTestLogId: string): string {
  return path.posix.join("hydrostatic-test-logs", hydrostaticTestLogId);
}

export function extinguisherChangeLogOwnerKey(extinguisherChangeLogId: string): string {
  return path.posix.join("extinguisher-change-logs", extinguisherChangeLogId);
}

export function valveChangeLogOwnerKey(valveChangeLogId: string): string {
  return path.posix.join("valve-change-logs", valveChangeLogId);
}

export function valveCorrectiveMaintenanceLogOwnerKey(valveCorrectiveMaintenanceLogId: string): string {
  return path.posix.join("valve-corrective-maintenance-logs", valveCorrectiveMaintenanceLogId);
}

export function hoseChangeLogOwnerKey(hoseChangeLogId: string): string {
  return path.posix.join("hose-change-logs", hoseChangeLogId);
}

// Solo las llaves foráneas que determinan dónde vive el archivo de un
// documento. Un documento pertenece a una bitácora, a una unidad o al
// apartado, en ese orden de prioridad (igual que en deleteDocument).
export type DocumentOwnerFields = {
  sectionId: string;
  vehicleRecordId: string | null;
  maintenanceLogId: string | null;
  ultrasoundLogId: string | null;
  visualInspectionLogId: string | null;
  tightnessTestLogId: string | null;
  internalVisualInspectionLogId: string | null;
  hydrostaticTestLogId: string | null;
  extinguisherChangeLogId: string | null;
  valveChangeLogId: string | null;
  valveCorrectiveMaintenanceLogId: string | null;
  hoseChangeLogId: string | null;
};

export function ownerKeyForDocument(document: DocumentOwnerFields): string {
  if (document.maintenanceLogId) return maintenanceLogOwnerKey(document.maintenanceLogId);
  if (document.ultrasoundLogId) return ultrasoundLogOwnerKey(document.ultrasoundLogId);
  if (document.visualInspectionLogId) return visualInspectionLogOwnerKey(document.visualInspectionLogId);
  if (document.tightnessTestLogId) return tightnessTestLogOwnerKey(document.tightnessTestLogId);
  if (document.internalVisualInspectionLogId)
    return internalVisualInspectionLogOwnerKey(document.internalVisualInspectionLogId);
  if (document.hydrostaticTestLogId) return hydrostaticTestLogOwnerKey(document.hydrostaticTestLogId);
  if (document.extinguisherChangeLogId)
    return extinguisherChangeLogOwnerKey(document.extinguisherChangeLogId);
  if (document.valveChangeLogId) return valveChangeLogOwnerKey(document.valveChangeLogId);
  if (document.valveCorrectiveMaintenanceLogId)
    return valveCorrectiveMaintenanceLogOwnerKey(document.valveCorrectiveMaintenanceLogId);
  if (document.hoseChangeLogId) return hoseChangeLogOwnerKey(document.hoseChangeLogId);
  if (document.vehicleRecordId) return vehicleOwnerKey(document.vehicleRecordId);
  return document.sectionId;
}

// Borrar una unidad, una bitácora, un apartado o una ciudad se lleva sus
// documentos en cascada, pero la cascada de la base no toca el disco: sin
// esto los PDF quedaban ahí para siempre, sin nada que los apuntara. Hay que
// llamarla ANTES de borrar el registro, mientras los documentos existen.
export async function deleteDocumentFiles(
  documents: (DocumentOwnerFields & { storedName: string })[]
): Promise<void> {
  for (const document of documents) {
    await deleteDocumentFile(ownerKeyForDocument(document), document.storedName);
  }
}

// Lee cero o más PDFs adjuntos en el mismo envío de un formulario (p. ej. al
// registrar un mantenimiento o un ultrasonido, sin tener que subirlos después
// por separado). A diferencia de un solo archivo requerido, aquí no adjuntar
// nada es válido; solo se valida lo que sí venga.
export function readOptionalPdfFiles(formData: FormData, fieldName = "files"): File[] | { error: string } {
  const files = formData.getAll(fieldName).filter((value): value is File => value instanceof File && value.size > 0);
  for (const file of files) {
    if (file.type !== "application/pdf") {
      return { error: `"${file.name}" no es un PDF.` };
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      return { error: `"${file.name}" supera el tamaño máximo permitido (20 MB).` };
    }
  }
  return files;
}

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Lee un solo campo de imagen opcional (foto de antes/después de un
// mantenimiento). No adjuntar nada es válido; solo se valida lo que sí venga.
export function readOptionalImageFile(formData: FormData, fieldName: string): File | null | { error: string } {
  const file = formData.get(fieldName);
  if (!(file instanceof File) || file.size === 0) {
    return null;
  }
  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    return { error: `"${file.name}" no es una imagen válida (JPG, PNG o WEBP).` };
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return { error: `"${file.name}" supera el tamaño máximo permitido (20 MB).` };
  }
  return file;
}
