-- AlterTable
ALTER TABLE "custom_fields" ADD COLUMN "apartadoSlug" TEXT;

-- CreateTable
CREATE TABLE "custom_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ambito" TEXT NOT NULL,
    "apartadoSlug" TEXT,
    "titulo" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

