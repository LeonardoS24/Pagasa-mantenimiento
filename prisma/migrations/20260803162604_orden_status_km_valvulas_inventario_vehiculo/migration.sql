-- AlterTable
ALTER TABLE "maintenance_logs" ADD COLUMN "kilometraje" INTEGER;

-- AlterTable
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "fechaFabricacionValvulaAlivio" DATETIME;
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "fechaFabricacionValvulaLlenado" DATETIME;
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "fechaFabricacionValvulaMaximoLlenado" DATETIME;
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "fechaFabricacionValvulaServicio" DATETIME;
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "fechaInstalacionValvulas" DATETIME;
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "fechaProximoMantenimiento" DATETIME;
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "fechaUltimoMantenimiento" DATETIME;
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "kilometrajeProximoMantenimiento" INTEGER;
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "kilometrajeUltimoMantenimiento" INTEGER;

-- CreateTable
CREATE TABLE "valve_change_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "responsable" TEXT,
    "fechaInstalacion" DATETIME NOT NULL,
    "fechaFabricacionValvulaLlenado" DATETIME NOT NULL,
    "fechaFabricacionValvulaServicio" DATETIME NOT NULL,
    "fechaFabricacionValvulaMaximoLlenado" DATETIME NOT NULL,
    "fechaFabricacionValvulaAlivio" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "valve_change_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "valve_change_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "valveChangeLogId" TEXT,
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
    CONSTRAINT "documents_tightnessTestLogId_fkey" FOREIGN KEY ("tightnessTestLogId") REFERENCES "tightness_test_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_internalVisualInspectionLogId_fkey" FOREIGN KEY ("internalVisualInspectionLogId") REFERENCES "internal_visual_inspection_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_hydrostaticTestLogId_fkey" FOREIGN KEY ("hydrostaticTestLogId") REFERENCES "hydrostatic_test_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_extinguisherChangeLogId_fkey" FOREIGN KEY ("extinguisherChangeLogId") REFERENCES "extinguisher_change_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_valveChangeLogId_fkey" FOREIGN KEY ("valveChangeLogId") REFERENCES "valve_change_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_documents" ("createdAt", "extinguisherChangeLogId", "fileName", "hydrostaticTestLogId", "id", "internalVisualInspectionLogId", "maintenanceLogId", "mimeType", "sectionId", "size", "storedName", "tightnessTestLogId", "ultrasoundLogId", "uploadedById", "vehicleRecordId", "visualInspectionLogId") SELECT "createdAt", "extinguisherChangeLogId", "fileName", "hydrostaticTestLogId", "id", "internalVisualInspectionLogId", "maintenanceLogId", "mimeType", "sectionId", "size", "storedName", "tightnessTestLogId", "ultrasoundLogId", "uploadedById", "vehicleRecordId", "visualInspectionLogId" FROM "documents";
DROP TABLE "documents";
ALTER TABLE "new_documents" RENAME TO "documents";
CREATE TABLE "new_inventory_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "pieceOrderId" TEXT,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'EN_INVENTARIO',
    "usedOnVehicleId" TEXT,
    "fechaIngreso" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaPorUtilizarDesde" DATETIME,
    "fechaUtilizada" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "inventory_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_pieceOrderId_fkey" FOREIGN KEY ("pieceOrderId") REFERENCES "piece_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_usedOnVehicleId_fkey" FOREIGN KEY ("usedOnVehicleId") REFERENCES "vehicle_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_inventory_items" ("cantidad", "createdAt", "createdById", "estado", "fechaIngreso", "fechaPorUtilizarDesde", "fechaUtilizada", "id", "nombre", "pieceOrderId", "sectionId", "tipo", "unidad", "updatedAt") SELECT "cantidad", "createdAt", "createdById", "estado", "fechaIngreso", "fechaPorUtilizarDesde", "fechaUtilizada", "id", "nombre", "pieceOrderId", "sectionId", "tipo", "unidad", "updatedAt" FROM "inventory_items";
DROP TABLE "inventory_items";
ALTER TABLE "new_inventory_items" RENAME TO "inventory_items";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
