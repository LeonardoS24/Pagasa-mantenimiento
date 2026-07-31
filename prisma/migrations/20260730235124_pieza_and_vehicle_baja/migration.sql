-- AlterTable
ALTER TABLE "maintenance_logs" ADD COLUMN "pieza" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_vehicle_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sectionId" TEXT NOT NULL,
    "numeroEconomico" TEXT NOT NULL,
    "sucursal" TEXT NOT NULL,
    "anio" TEXT NOT NULL,
    "placas" TEXT NOT NULL,
    "numeroAnterior" TEXT,
    "localidadAnterior" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaBaja" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vehicle_records_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_vehicle_records" ("anio", "createdAt", "id", "localidadAnterior", "numeroAnterior", "numeroEconomico", "order", "placas", "sectionId", "sucursal", "updatedAt") SELECT "anio", "createdAt", "id", "localidadAnterior", "numeroAnterior", "numeroEconomico", "order", "placas", "sectionId", "sucursal", "updatedAt" FROM "vehicle_records";
DROP TABLE "vehicle_records";
ALTER TABLE "new_vehicle_records" RENAME TO "vehicle_records";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
