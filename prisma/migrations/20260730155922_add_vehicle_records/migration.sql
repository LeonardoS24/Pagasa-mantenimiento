-- CreateTable
CREATE TABLE "vehicle_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sectionId" TEXT NOT NULL,
    "numeroEconomico" TEXT NOT NULL,
    "sucursal" TEXT NOT NULL,
    "anio" TEXT NOT NULL,
    "placas" TEXT NOT NULL,
    "numeroAnterior" TEXT,
    "localidadAnterior" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vehicle_records_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
