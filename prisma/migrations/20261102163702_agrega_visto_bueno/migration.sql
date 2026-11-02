-- CreateTable
CREATE TABLE "VistoBueno" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entidad" TEXT NOT NULL,
    "registroId" TEXT NOT NULL,
    "vehicleRecordId" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "comentario" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VistoBueno_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "VistoBueno_vehicleRecordId_idx" ON "VistoBueno"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "VistoBueno_userId_idx" ON "VistoBueno"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VistoBueno_entidad_registroId_key" ON "VistoBueno"("entidad", "registroId");
