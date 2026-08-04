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
    "valveCorrectiveMaintenanceLogId" TEXT,
    "hoseChangeLogId" TEXT,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
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
    CONSTRAINT "documents_valveChangeLogId_fkey" FOREIGN KEY ("valveChangeLogId") REFERENCES "valve_change_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_valveCorrectiveMaintenanceLogId_fkey" FOREIGN KEY ("valveCorrectiveMaintenanceLogId") REFERENCES "valve_corrective_maintenance_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_hoseChangeLogId_fkey" FOREIGN KEY ("hoseChangeLogId") REFERENCES "hose_change_logs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_documents" ("createdAt", "extinguisherChangeLogId", "fileName", "hoseChangeLogId", "hydrostaticTestLogId", "id", "internalVisualInspectionLogId", "maintenanceLogId", "mimeType", "sectionId", "size", "storedName", "tightnessTestLogId", "ultrasoundLogId", "uploadedById", "valveChangeLogId", "valveCorrectiveMaintenanceLogId", "vehicleRecordId", "visualInspectionLogId") SELECT "createdAt", "extinguisherChangeLogId", "fileName", "hoseChangeLogId", "hydrostaticTestLogId", "id", "internalVisualInspectionLogId", "maintenanceLogId", "mimeType", "sectionId", "size", "storedName", "tightnessTestLogId", "ultrasoundLogId", "uploadedById", "valveChangeLogId", "valveCorrectiveMaintenanceLogId", "vehicleRecordId", "visualInspectionLogId" FROM "documents";
DROP TABLE "documents";
ALTER TABLE "new_documents" RENAME TO "documents";
CREATE TABLE "new_extinguisher_change_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "responsable" TEXT,
    "fechaInstalacion" DATETIME NOT NULL,
    "fechaVencimiento" DATETIME NOT NULL,
    "calidad" TEXT NOT NULL,
    "fechaRealizacion" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "extinguisher_change_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "extinguisher_change_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_extinguisher_change_logs" ("calidad", "createdAt", "createdById", "fechaInstalacion", "fechaRealizacion", "fechaVencimiento", "id", "responsable", "updatedAt", "vehicleRecordId") SELECT "calidad", "createdAt", "createdById", "fechaInstalacion", "fechaRealizacion", "fechaVencimiento", "id", "responsable", "updatedAt", "vehicleRecordId" FROM "extinguisher_change_logs";
DROP TABLE "extinguisher_change_logs";
ALTER TABLE "new_extinguisher_change_logs" RENAME TO "extinguisher_change_logs";
CREATE TABLE "new_hose_change_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "responsable" TEXT,
    "fechaInstalacion" DATETIME NOT NULL,
    "fechaFabricacionManguera" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "hose_change_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hose_change_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_hose_change_logs" ("createdAt", "createdById", "fechaFabricacionManguera", "fechaInstalacion", "id", "responsable", "updatedAt", "vehicleRecordId") SELECT "createdAt", "createdById", "fechaFabricacionManguera", "fechaInstalacion", "id", "responsable", "updatedAt", "vehicleRecordId" FROM "hose_change_logs";
DROP TABLE "hose_change_logs";
ALTER TABLE "new_hose_change_logs" RENAME TO "hose_change_logs";
CREATE TABLE "new_hydrostatic_test_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "compania" TEXT,
    "numeroPrueba" TEXT,
    "responsable" TEXT,
    "fechaUltimaPrueba" DATETIME,
    "fechaRealizacion" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "hydrostatic_test_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hydrostatic_test_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_hydrostatic_test_logs" ("compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaPrueba", "id", "numeroPrueba", "responsable", "updatedAt", "vehicleRecordId") SELECT "compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaPrueba", "id", "numeroPrueba", "responsable", "updatedAt", "vehicleRecordId" FROM "hydrostatic_test_logs";
DROP TABLE "hydrostatic_test_logs";
ALTER TABLE "new_hydrostatic_test_logs" RENAME TO "hydrostatic_test_logs";
CREATE TABLE "new_internal_visual_inspection_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "compania" TEXT,
    "numeroInspeccion" TEXT,
    "responsable" TEXT,
    "fechaUltimaInspeccion" DATETIME,
    "fechaRealizacion" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "internal_visual_inspection_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "internal_visual_inspection_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_internal_visual_inspection_logs" ("compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaInspeccion", "id", "numeroInspeccion", "responsable", "updatedAt", "vehicleRecordId") SELECT "compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaInspeccion", "id", "numeroInspeccion", "responsable", "updatedAt", "vehicleRecordId" FROM "internal_visual_inspection_logs";
DROP TABLE "internal_visual_inspection_logs";
ALTER TABLE "new_internal_visual_inspection_logs" RENAME TO "internal_visual_inspection_logs";
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
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "inventory_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_pieceOrderId_fkey" FOREIGN KEY ("pieceOrderId") REFERENCES "piece_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_usedOnVehicleId_fkey" FOREIGN KEY ("usedOnVehicleId") REFERENCES "vehicle_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_inventory_items" ("cantidad", "createdAt", "createdById", "estado", "fechaIngreso", "fechaPorUtilizarDesde", "fechaUtilizada", "id", "nombre", "pieceOrderId", "sectionId", "tipo", "unidad", "updatedAt", "usedOnVehicleId") SELECT "cantidad", "createdAt", "createdById", "estado", "fechaIngreso", "fechaPorUtilizarDesde", "fechaUtilizada", "id", "nombre", "pieceOrderId", "sectionId", "tipo", "unidad", "updatedAt", "usedOnVehicleId" FROM "inventory_items";
DROP TABLE "inventory_items";
ALTER TABLE "new_inventory_items" RENAME TO "inventory_items";
CREATE TABLE "new_maintenance_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "tipoMantenimiento" TEXT NOT NULL,
    "tipoServicio" TEXT NOT NULL,
    "pieza" TEXT,
    "cantidad" TEXT,
    "unidad" TEXT,
    "descripcion" TEXT,
    "observacion" TEXT,
    "fecha" DATETIME NOT NULL,
    "kilometraje" INTEGER,
    "nombreOperador" TEXT,
    "auxiliarTecnico" TEXT,
    "responsableTrabajoMecanico" TEXT,
    "estatus" TEXT NOT NULL DEFAULT 'SIN_ATENCION',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "maintenance_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "maintenance_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_maintenance_logs" ("auxiliarTecnico", "cantidad", "createdAt", "createdById", "descripcion", "estatus", "fecha", "id", "kilometraje", "nombreOperador", "observacion", "pieza", "responsableTrabajoMecanico", "tipoMantenimiento", "tipoServicio", "unidad", "updatedAt", "vehicleRecordId") SELECT "auxiliarTecnico", "cantidad", "createdAt", "createdById", "descripcion", "estatus", "fecha", "id", "kilometraje", "nombreOperador", "observacion", "pieza", "responsableTrabajoMecanico", "tipoMantenimiento", "tipoServicio", "unidad", "updatedAt", "vehicleRecordId" FROM "maintenance_logs";
DROP TABLE "maintenance_logs";
ALTER TABLE "new_maintenance_logs" RENAME TO "maintenance_logs";
CREATE TABLE "new_piece_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fechaOrden" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "piece_orders_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "piece_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_piece_orders" ("cantidad", "createdAt", "createdById", "estado", "fechaOrden", "id", "nombre", "sectionId", "tipo", "unidad", "updatedAt") SELECT "cantidad", "createdAt", "createdById", "estado", "fechaOrden", "id", "nombre", "sectionId", "tipo", "unidad", "updatedAt" FROM "piece_orders";
DROP TABLE "piece_orders";
ALTER TABLE "new_piece_orders" RENAME TO "piece_orders";
CREATE TABLE "new_tightness_test_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "compania" TEXT,
    "numeroPrueba" TEXT,
    "responsable" TEXT,
    "fechaUltimaPrueba" DATETIME,
    "fechaRealizacion" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tightness_test_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tightness_test_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tightness_test_logs" ("compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaPrueba", "id", "numeroPrueba", "responsable", "updatedAt", "vehicleRecordId") SELECT "compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaPrueba", "id", "numeroPrueba", "responsable", "updatedAt", "vehicleRecordId" FROM "tightness_test_logs";
DROP TABLE "tightness_test_logs";
ALTER TABLE "new_tightness_test_logs" RENAME TO "tightness_test_logs";
CREATE TABLE "new_ultrasound_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "compania" TEXT,
    "numeroUltrasonido" TEXT,
    "responsable" TEXT,
    "fechaUltimoUltrasonido" DATETIME,
    "fechaRealizacion" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ultrasound_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ultrasound_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ultrasound_logs" ("compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimoUltrasonido", "id", "numeroUltrasonido", "responsable", "updatedAt", "vehicleRecordId") SELECT "compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimoUltrasonido", "id", "numeroUltrasonido", "responsable", "updatedAt", "vehicleRecordId" FROM "ultrasound_logs";
DROP TABLE "ultrasound_logs";
ALTER TABLE "new_ultrasound_logs" RENAME TO "ultrasound_logs";
CREATE TABLE "new_valve_change_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "responsable" TEXT,
    "fechaInstalacion" DATETIME NOT NULL,
    "fechaFabricacionValvulaLlenado" DATETIME NOT NULL,
    "fechaFabricacionValvulaServicio" DATETIME NOT NULL,
    "fechaFabricacionValvulaMaximoLlenado" DATETIME NOT NULL,
    "fechaFabricacionValvulaAlivio" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "valve_change_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "valve_change_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_valve_change_logs" ("createdAt", "createdById", "fechaFabricacionValvulaAlivio", "fechaFabricacionValvulaLlenado", "fechaFabricacionValvulaMaximoLlenado", "fechaFabricacionValvulaServicio", "fechaInstalacion", "id", "responsable", "updatedAt", "vehicleRecordId") SELECT "createdAt", "createdById", "fechaFabricacionValvulaAlivio", "fechaFabricacionValvulaLlenado", "fechaFabricacionValvulaMaximoLlenado", "fechaFabricacionValvulaServicio", "fechaInstalacion", "id", "responsable", "updatedAt", "vehicleRecordId" FROM "valve_change_logs";
DROP TABLE "valve_change_logs";
ALTER TABLE "new_valve_change_logs" RENAME TO "valve_change_logs";
CREATE TABLE "new_valve_corrective_maintenance_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "valvula" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "responsable" TEXT,
    "fecha" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "valve_corrective_maintenance_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "valve_corrective_maintenance_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_valve_corrective_maintenance_logs" ("createdAt", "createdById", "descripcion", "fecha", "id", "responsable", "updatedAt", "valvula", "vehicleRecordId") SELECT "createdAt", "createdById", "descripcion", "fecha", "id", "responsable", "updatedAt", "valvula", "vehicleRecordId" FROM "valve_corrective_maintenance_logs";
DROP TABLE "valve_corrective_maintenance_logs";
ALTER TABLE "new_valve_corrective_maintenance_logs" RENAME TO "valve_corrective_maintenance_logs";
CREATE TABLE "new_visual_inspection_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "compania" TEXT,
    "numeroInspeccion" TEXT,
    "responsable" TEXT,
    "fechaUltimaInspeccion" DATETIME,
    "fechaRealizacion" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "visual_inspection_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "visual_inspection_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_visual_inspection_logs" ("compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaInspeccion", "id", "numeroInspeccion", "responsable", "updatedAt", "vehicleRecordId") SELECT "compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaInspeccion", "id", "numeroInspeccion", "responsable", "updatedAt", "vehicleRecordId" FROM "visual_inspection_logs";
DROP TABLE "visual_inspection_logs";
ALTER TABLE "new_visual_inspection_logs" RENAME TO "visual_inspection_logs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
