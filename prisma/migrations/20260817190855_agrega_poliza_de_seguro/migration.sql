-- CreateTable
CREATE TABLE "insurance_policy_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "fechaRealizacion" DATETIME NOT NULL,
    "fechaVencimiento" DATETIME NOT NULL,
    "aseguradora" TEXT,
    "numeroPoliza" TEXT,
    "observaciones" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "insurance_policy_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "insurance_policy_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
    "tightnessTestLogId" TEXT,
    "internalVisualInspectionLogId" TEXT,
    "hydrostaticTestLogId" TEXT,
    "extinguisherChangeLogId" TEXT,
    "insurancePolicyLogId" TEXT,
    "valveChangeLogId" TEXT,
    "valveCorrectiveMaintenanceLogId" TEXT,
    "hoseChangeLogId" TEXT,
    "equipoId" TEXT,
    "equipmentLogId" TEXT,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ADJUNTO',
    "fecha" DATETIME,
    "uploadedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "documents_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_maintenanceLogId_fkey" FOREIGN KEY ("maintenanceLogId") REFERENCES "maintenance_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_ultrasoundLogId_fkey" FOREIGN KEY ("ultrasoundLogId") REFERENCES "ultrasound_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_visualInspectionLogId_fkey" FOREIGN KEY ("visualInspectionLogId") REFERENCES "visual_inspection_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_tightnessTestLogId_fkey" FOREIGN KEY ("tightnessTestLogId") REFERENCES "tightness_test_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_internalVisualInspectionLogId_fkey" FOREIGN KEY ("internalVisualInspectionLogId") REFERENCES "internal_visual_inspection_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_hydrostaticTestLogId_fkey" FOREIGN KEY ("hydrostaticTestLogId") REFERENCES "hydrostatic_test_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_extinguisherChangeLogId_fkey" FOREIGN KEY ("extinguisherChangeLogId") REFERENCES "extinguisher_change_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_insurancePolicyLogId_fkey" FOREIGN KEY ("insurancePolicyLogId") REFERENCES "insurance_policy_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_valveChangeLogId_fkey" FOREIGN KEY ("valveChangeLogId") REFERENCES "valve_change_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_valveCorrectiveMaintenanceLogId_fkey" FOREIGN KEY ("valveCorrectiveMaintenanceLogId") REFERENCES "valve_corrective_maintenance_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_hoseChangeLogId_fkey" FOREIGN KEY ("hoseChangeLogId") REFERENCES "hose_change_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "equipos" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_equipmentLogId_fkey" FOREIGN KEY ("equipmentLogId") REFERENCES "equipment_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_documents" ("createdAt", "equipmentLogId", "equipoId", "extinguisherChangeLogId", "fecha", "fileName", "hoseChangeLogId", "hydrostaticTestLogId", "id", "internalVisualInspectionLogId", "kind", "maintenanceLogId", "mimeType", "sectionId", "size", "storedName", "tightnessTestLogId", "ultrasoundLogId", "uploadedById", "valveChangeLogId", "valveCorrectiveMaintenanceLogId", "vehicleRecordId", "visualInspectionLogId") SELECT "createdAt", "equipmentLogId", "equipoId", "extinguisherChangeLogId", "fecha", "fileName", "hoseChangeLogId", "hydrostaticTestLogId", "id", "internalVisualInspectionLogId", "kind", "maintenanceLogId", "mimeType", "sectionId", "size", "storedName", "tightnessTestLogId", "ultrasoundLogId", "uploadedById", "valveChangeLogId", "valveCorrectiveMaintenanceLogId", "vehicleRecordId", "visualInspectionLogId" FROM "documents";
DROP TABLE "documents";
ALTER TABLE "new_documents" RENAME TO "documents";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
