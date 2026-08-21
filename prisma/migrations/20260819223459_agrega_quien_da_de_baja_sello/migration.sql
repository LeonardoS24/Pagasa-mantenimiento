-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_seal_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "numeroSello" TEXT NOT NULL,
    "fechaInstalacion" DATETIME NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaBaja" DATETIME,
    "motivoBaja" TEXT,
    "createdById" TEXT,
    "deactivatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "seal_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "seal_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "seal_logs_deactivatedById_fkey" FOREIGN KEY ("deactivatedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_seal_logs" ("activo", "createdAt", "createdById", "fechaBaja", "fechaInstalacion", "id", "motivoBaja", "numeroSello", "updatedAt", "vehicleRecordId") SELECT "activo", "createdAt", "createdById", "fechaBaja", "fechaInstalacion", "id", "motivoBaja", "numeroSello", "updatedAt", "vehicleRecordId" FROM "seal_logs";
DROP TABLE "seal_logs";
ALTER TABLE "new_seal_logs" RENAME TO "seal_logs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
