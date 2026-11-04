-- CreateTable
CREATE TABLE "traspasos_unidad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT,
    "numeroEconomico" TEXT NOT NULL,
    "apartadoSlug" TEXT NOT NULL,
    "origenCiudadNombre" TEXT NOT NULL,
    "origenCiudadSlug" TEXT NOT NULL,
    "destinoCiudadNombre" TEXT NOT NULL,
    "destinoCiudadSlug" TEXT NOT NULL,
    "motivo" TEXT,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "traspasos_unidad_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "traspasos_unidad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "traspasos_unidad_vehicleRecordId_idx" ON "traspasos_unidad"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "traspasos_unidad_userId_idx" ON "traspasos_unidad"("userId");
