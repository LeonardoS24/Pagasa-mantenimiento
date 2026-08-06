-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_piece_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fechaOrden" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "vehicleRecordId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "piece_orders_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "piece_orders_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "piece_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_piece_orders" ("cantidad", "createdAt", "createdById", "estado", "fechaOrden", "id", "nombre", "sectionId", "tipo", "unidad", "updatedAt") SELECT "cantidad", "createdAt", "createdById", "estado", "fechaOrden", "id", "nombre", "sectionId", "tipo", "unidad", "updatedAt" FROM "piece_orders";
DROP TABLE "piece_orders";
ALTER TABLE "new_piece_orders" RENAME TO "piece_orders";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
