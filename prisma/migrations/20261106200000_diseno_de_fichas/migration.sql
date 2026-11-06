-- CreateTable
CREATE TABLE "diseno_fichas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "apartadoSlug" TEXT NOT NULL,
    "datos" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "diseno_fichas_apartadoSlug_key" ON "diseno_fichas"("apartadoSlug");
