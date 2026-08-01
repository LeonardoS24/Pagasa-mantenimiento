-- AlterTable
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "fechaProximaInspeccionVisual" DATETIME;
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "numeroUltimaInspeccionVisual" TEXT;
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "ultimaInspeccionVisual" DATETIME;

-- CreateTable
CREATE TABLE "visual_inspection_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "compania" TEXT,
    "numeroInspeccion" TEXT,
    "responsable" TEXT,
    "fechaUltimaInspeccion" DATETIME,
    "fechaRealizacion" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "visual_inspection_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "visual_inspection_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "vehicleRecordId" TEXT,
    "maintenanceLogId" TEXT,
    "ultrasoundLogId" TEXT,
    "visualInspectionLogId" TEXT,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_maintenanceLogId_fkey" FOREIGN KEY ("maintenanceLogId") REFERENCES "maintenance_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_ultrasoundLogId_fkey" FOREIGN KEY ("ultrasoundLogId") REFERENCES "ultrasound_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_visualInspectionLogId_fkey" FOREIGN KEY ("visualInspectionLogId") REFERENCES "visual_inspection_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_documents" ("createdAt", "fileName", "id", "maintenanceLogId", "mimeType", "sectionId", "size", "storedName", "ultrasoundLogId", "uploadedById", "vehicleRecordId") SELECT "createdAt", "fileName", "id", "maintenanceLogId", "mimeType", "sectionId", "size", "storedName", "ultrasoundLogId", "uploadedById", "vehicleRecordId" FROM "documents";
DROP TABLE "documents";
ALTER TABLE "new_documents" RENAME TO "documents";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
