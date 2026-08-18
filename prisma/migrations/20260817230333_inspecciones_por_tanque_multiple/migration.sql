-- AlterTable
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaProximaInspeccionVisual" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaProximaInspeccionVisualInterna" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaProximaPruebaHermeticidad" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaProximaPruebaHidrostatica" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaProximoUltrasonido" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "numeroUltimaInspeccionVisual" TEXT;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "numeroUltimaInspeccionVisualInterna" TEXT;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "numeroUltimaPruebaHermeticidad" TEXT;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "numeroUltimaPruebaHidrostatica" TEXT;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "numeroUltimoUltrasonido" TEXT;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "ultimaInspeccionVisual" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "ultimaInspeccionVisualInterna" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "ultimaPruebaHermeticidad" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "ultimaPruebaHidrostatica" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "ultimoUltrasonido" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_hydrostatic_test_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "stationTankTechnicalSheetId" TEXT,
    "compania" TEXT,
    "numeroPrueba" TEXT,
    "responsable" TEXT,
    "fechaUltimaPrueba" DATETIME,
    "fechaRealizacion" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "hydrostatic_test_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "hydrostatic_test_logs_stationTankTechnicalSheetId_fkey" FOREIGN KEY ("stationTankTechnicalSheetId") REFERENCES "station_tank_technical_sheets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "hydrostatic_test_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_hydrostatic_test_logs" ("compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaPrueba", "id", "numeroPrueba", "responsable", "updatedAt", "vehicleRecordId") SELECT "compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaPrueba", "id", "numeroPrueba", "responsable", "updatedAt", "vehicleRecordId" FROM "hydrostatic_test_logs";
DROP TABLE "hydrostatic_test_logs";
ALTER TABLE "new_hydrostatic_test_logs" RENAME TO "hydrostatic_test_logs";
CREATE TABLE "new_internal_visual_inspection_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "stationTankTechnicalSheetId" TEXT,
    "compania" TEXT,
    "numeroInspeccion" TEXT,
    "responsable" TEXT,
    "fechaUltimaInspeccion" DATETIME,
    "fechaRealizacion" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "internal_visual_inspection_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "internal_visual_inspection_logs_stationTankTechnicalSheetId_fkey" FOREIGN KEY ("stationTankTechnicalSheetId") REFERENCES "station_tank_technical_sheets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "internal_visual_inspection_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_internal_visual_inspection_logs" ("compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaInspeccion", "id", "numeroInspeccion", "responsable", "updatedAt", "vehicleRecordId") SELECT "compania", "createdAt", "createdById", "fechaRealizacion", "fechaUltimaInspeccion", "id", "numeroInspeccion", "responsable", "updatedAt", "vehicleRecordId" FROM "internal_visual_inspection_logs";
DROP TABLE "internal_visual_inspection_logs";
ALTER TABLE "new_internal_visual_inspection_logs" RENAME TO "internal_visual_inspection_logs";
CREATE TABLE "new_tightness_test_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "stationTankTechnicalSheetId" TEXT,
    "compania" TEXT,
    "numeroPrueba" TEXT,
    "responsable" TEXT,
    "fechaUltimaPrueba" DATETIME,
    "fechaRealizacion" DATETIME NOT NULL,
    "fechaProximaPrueba" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tightness_test_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "tightness_test_logs_stationTankTechnicalSheetId_fkey" FOREIGN KEY ("stationTankTechnicalSheetId") REFERENCES "station_tank_technical_sheets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tightness_test_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_tightness_test_logs" ("compania", "createdAt", "createdById", "fechaProximaPrueba", "fechaRealizacion", "fechaUltimaPrueba", "id", "numeroPrueba", "responsable", "updatedAt", "vehicleRecordId") SELECT "compania", "createdAt", "createdById", "fechaProximaPrueba", "fechaRealizacion", "fechaUltimaPrueba", "id", "numeroPrueba", "responsable", "updatedAt", "vehicleRecordId" FROM "tightness_test_logs";
DROP TABLE "tightness_test_logs";
ALTER TABLE "new_tightness_test_logs" RENAME TO "tightness_test_logs";
CREATE TABLE "new_ultrasound_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "stationTankTechnicalSheetId" TEXT,
    "compania" TEXT,
    "numeroUltrasonido" TEXT,
    "responsable" TEXT,
    "fechaUltimoUltrasonido" DATETIME,
    "fechaRealizacion" DATETIME NOT NULL,
    "fechaProximoUltrasonido" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ultrasound_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ultrasound_logs_stationTankTechnicalSheetId_fkey" FOREIGN KEY ("stationTankTechnicalSheetId") REFERENCES "station_tank_technical_sheets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ultrasound_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ultrasound_logs" ("compania", "createdAt", "createdById", "fechaProximoUltrasonido", "fechaRealizacion", "fechaUltimoUltrasonido", "id", "numeroUltrasonido", "responsable", "updatedAt", "vehicleRecordId") SELECT "compania", "createdAt", "createdById", "fechaProximoUltrasonido", "fechaRealizacion", "fechaUltimoUltrasonido", "id", "numeroUltrasonido", "responsable", "updatedAt", "vehicleRecordId" FROM "ultrasound_logs";
DROP TABLE "ultrasound_logs";
ALTER TABLE "new_ultrasound_logs" RENAME TO "ultrasound_logs";
CREATE TABLE "new_visual_inspection_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "stationTankTechnicalSheetId" TEXT,
    "compania" TEXT,
    "numeroInspeccion" TEXT,
    "responsable" TEXT,
    "fechaUltimaInspeccion" DATETIME,
    "fechaRealizacion" DATETIME NOT NULL,
    "fechaProximaInspeccion" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "visual_inspection_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "visual_inspection_logs_stationTankTechnicalSheetId_fkey" FOREIGN KEY ("stationTankTechnicalSheetId") REFERENCES "station_tank_technical_sheets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "visual_inspection_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_visual_inspection_logs" ("compania", "createdAt", "createdById", "fechaProximaInspeccion", "fechaRealizacion", "fechaUltimaInspeccion", "id", "numeroInspeccion", "responsable", "updatedAt", "vehicleRecordId") SELECT "compania", "createdAt", "createdById", "fechaProximaInspeccion", "fechaRealizacion", "fechaUltimaInspeccion", "id", "numeroInspeccion", "responsable", "updatedAt", "vehicleRecordId" FROM "visual_inspection_logs";
DROP TABLE "visual_inspection_logs";
ALTER TABLE "new_visual_inspection_logs" RENAME TO "visual_inspection_logs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
