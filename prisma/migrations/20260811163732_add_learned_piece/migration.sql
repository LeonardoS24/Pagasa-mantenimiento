-- CreateTable
CREATE TABLE "learned_pieces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoria" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_valve_change_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "responsable" TEXT,
    "fechaInstalacion" DATETIME NOT NULL,
    "fechaFabricacionValvulaLlenado" DATETIME NOT NULL,
    "fechaFabricacionValvulaNoRetroceso" DATETIME NOT NULL,
    "fechaFabricacionValvulaBypass" DATETIME NOT NULL,
    "fechaFabricacionValvulaRetornoVapores" DATETIME NOT NULL,
    "fechaFabricacionValvulaServicio" DATETIME NOT NULL,
    "fechaFabricacionValvulaMaximoLlenado" DATETIME NOT NULL,
    "tieneValvulaMaximoLlenado85" BOOLEAN NOT NULL DEFAULT false,
    "fechaFabricacionValvulaMaximoLlenado85" DATETIME,
    "fechaFabricacionValvulaAlivio" DATETIME NOT NULL,
    "fechaFabricacionValvulaDescargaEmergencia" DATETIME NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "valve_change_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "valve_change_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_valve_change_logs" ("createdAt", "createdById", "fechaFabricacionValvulaAlivio", "fechaFabricacionValvulaBypass", "fechaFabricacionValvulaDescargaEmergencia", "fechaFabricacionValvulaLlenado", "fechaFabricacionValvulaMaximoLlenado", "fechaFabricacionValvulaMaximoLlenado85", "fechaFabricacionValvulaNoRetroceso", "fechaFabricacionValvulaRetornoVapores", "fechaFabricacionValvulaServicio", "fechaInstalacion", "id", "responsable", "tieneValvulaMaximoLlenado85", "updatedAt", "vehicleRecordId") SELECT "createdAt", "createdById", "fechaFabricacionValvulaAlivio", "fechaFabricacionValvulaBypass", "fechaFabricacionValvulaDescargaEmergencia", "fechaFabricacionValvulaLlenado", "fechaFabricacionValvulaMaximoLlenado", "fechaFabricacionValvulaMaximoLlenado85", "fechaFabricacionValvulaNoRetroceso", "fechaFabricacionValvulaRetornoVapores", "fechaFabricacionValvulaServicio", "fechaInstalacion", "id", "responsable", "tieneValvulaMaximoLlenado85", "updatedAt", "vehicleRecordId" FROM "valve_change_logs";
DROP TABLE "valve_change_logs";
ALTER TABLE "new_valve_change_logs" RENAME TO "valve_change_logs";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "learned_pieces_categoria_nombre_key" ON "learned_pieces"("categoria", "nombre");
