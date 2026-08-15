-- CreateTable
-- Ítems agregados por un ADMIN al checklist de mantenimiento preventivo.
CREATE TABLE "checklist_items_extra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lista" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "soloFugas" BOOLEAN NOT NULL DEFAULT false,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "checklist_items_extra_lista_nombre_key" ON "checklist_items_extra"("lista", "nombre");
