-- CreateTable
CREATE TABLE "piece_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "pieza" TEXT NOT NULL,
    "cantidad" TEXT,
    "fechaOrden" DATETIME NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "piece_orders_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "piece_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sectionId" TEXT NOT NULL,
    "pieceOrderId" TEXT,
    "pieza" TEXT NOT NULL,
    "cantidad" TEXT,
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

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_pieceOrderId_key" ON "inventory_items"("pieceOrderId");
