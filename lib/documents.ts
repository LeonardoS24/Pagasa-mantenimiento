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
