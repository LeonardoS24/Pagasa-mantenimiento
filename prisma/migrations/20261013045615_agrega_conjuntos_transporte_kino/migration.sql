-- CreateTable
CREATE TABLE "conjuntos_transporte" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cityId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "observaciones" TEXT,
    "tractocamionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "conjuntos_transporte_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conjuntos_transporte_tractocamionId_fkey" FOREIGN KEY ("tractocamionId") REFERENCES "vehicle_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conjunto_semirremolques" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conjuntoId" TEXT NOT NULL,
    "vehicleRecordId" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "conjunto_semirremolques_conjuntoId_fkey" FOREIGN KEY ("conjuntoId") REFERENCES "conjuntos_transporte" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "conjunto_semirremolques_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "conjunto_semirremolques_vehicleRecordId_key" ON "conjunto_semirremolques"("vehicleRecordId");
