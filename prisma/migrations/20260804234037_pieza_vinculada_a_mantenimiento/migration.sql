-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "usedOnMaintenanceLogId" TEXT,
    "usedOnValveChangeLogId" TEXT,
    "usedOnValveCorrectiveMaintenanceLogId" TEXT,
    "fechaIngreso" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaPorUtilizarDesde" DATETIME,
    "fechaUtilizada" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "inventory_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_pieceOrderId_fkey" FOREIGN KEY ("pieceOrderId") REFERENCES "piece_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_usedOnVehicleId_fkey" FOREIGN KEY ("usedOnVehicleId") REFERENCES "vehicle_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_usedOnMaintenanceLogId_fkey" FOREIGN KEY ("usedOnMaintenanceLogId") REFERENCES "maintenance_logs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_usedOnValveChangeLogId_fkey" FOREIGN KEY ("usedOnValveChangeLogId") REFERENCES "valve_change_logs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_usedOnValveCorrectiveMaintenanceLogId_fkey" FOREIGN KEY ("usedOnValveCorrectiveMaintenanceLogId") REFERENCES "valve_corrective_maintenance_logs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_inventory_items" ("cantidad", "createdAt", "createdById", "estado", "fechaIngreso", "fechaPorUtilizarDesde", "fechaUtilizada", "id", "nombre", "pieceOrderId", "sectionId", "tipo", "unidad", "updatedAt", "usedOnVehicleId") SELECT "cantidad", "createdAt", "createdById", "estado", "fechaIngreso", "fechaPorUtilizarDesde", "fechaUtilizada", "id", "nombre", "pieceOrderId", "sectionId", "tipo", "unidad", "updatedAt", "usedOnVehicleId" FROM "inventory_items";
DROP TABLE "inventory_items";
ALTER TABLE "new_inventory_items" RENAME TO "inventory_items";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
