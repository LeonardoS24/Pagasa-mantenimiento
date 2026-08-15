-- Puesto de la persona, visible en vez del rol técnico (ver User en schema.prisma)
ALTER TABLE "users" ADD COLUMN "puesto" TEXT;

-- Checklist de "Registrar orden": si sustituye a un equipo ya existente (ver
-- PieceOrder.sustituyeEquipoId en schema.prisma)
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
    "prioridad" TEXT NOT NULL DEFAULT 'NORMAL',
    "fechaAceptada" DATETIME,
    "vehicleRecordId" TEXT,
    "sustituyeEquipoId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "piece_orders_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "piece_orders_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "piece_orders_sustituyeEquipoId_fkey" FOREIGN KEY ("sustituyeEquipoId") REFERENCES "equipos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "piece_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_piece_orders" ("id", "sectionId", "tipo", "nombre", "unidad", "cantidad", "fechaOrden", "estado", "prioridad", "fechaAceptada", "vehicleRecordId", "createdById", "createdAt", "updatedAt")
SELECT "id", "sectionId", "tipo", "nombre", "unidad", "cantidad", "fechaOrden", "estado", "prioridad", "fechaAceptada", "vehicleRecordId", "createdById", "createdAt", "updatedAt" FROM "piece_orders";
DROP TABLE "piece_orders";
ALTER TABLE "new_piece_orders" RENAME TO "piece_orders";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
