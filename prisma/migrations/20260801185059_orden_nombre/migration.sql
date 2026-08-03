/*
  Warnings:

  - Added the required column `nombre` to the `inventory_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nombre` to the `piece_orders` table without a default value. This is not possible if the table is not empty.

*/
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
    "fechaIngreso" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaPorUtilizarDesde" DATETIME,
    "fechaUtilizada" DATETIME,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "inventory_items_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_pieceOrderId_fkey" FOREIGN KEY ("pieceOrderId") REFERENCES "piece_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "inventory_items_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_inventory_items" ("cantidad", "createdAt", "createdById", "estado", "fechaIngreso", "fechaPorUtilizarDesde", "fechaUtilizada", "id", "pieceOrderId", "sectionId", "tipo", "unidad", "updatedAt") SELECT "cantidad", "createdAt", "createdById", "estado", "fechaIngreso", "fechaPorUtilizarDesde", "fechaUtilizada", "id", "pieceOrderId", "sectionId", "tipo", "unidad", "updatedAt" FROM "inventory_items";
DROP TABLE "inventory_items";
ALTER TABLE "new_inventory_items" RENAME TO "inventory_items";
CREATE TABLE "new_piece_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "unidad" TEXT NOT NULL,
    "cantidad" INTEGER NOT NULL,
    "fechaOrden" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "piece_orders_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "piece_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_piece_orders" ("cantidad", "createdAt", "createdById", "estado", "fechaOrden", "id", "sectionId", "tipo", "unidad", "updatedAt") SELECT "cantidad", "createdAt", "createdById", "estado", "fechaOrden", "id", "sectionId", "tipo", "unidad", "updatedAt" FROM "piece_orders";
DROP TABLE "piece_orders";
ALTER TABLE "new_piece_orders" RENAME TO "piece_orders";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
