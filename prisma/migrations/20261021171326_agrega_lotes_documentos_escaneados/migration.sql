-- CreateTable
CREATE TABLE "lotes_documentos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cityId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "paginas" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ANALIZANDO',
    "error" TEXT,
    "documentos" TEXT NOT NULL DEFAULT '[]',
    "notasLector" TEXT,
    "tokensEntrada" INTEGER,
    "tokensSalida" INTEGER,
    "analizadoEl" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "lotes_documentos_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lotes_documentos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "lotes_documentos_cityId_createdAt_idx" ON "lotes_documentos"("cityId", "createdAt");
