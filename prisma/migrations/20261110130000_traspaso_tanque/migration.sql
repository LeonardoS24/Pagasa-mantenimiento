-- El tanque de una unidad dada de baja pasa a otra unidad.
CREATE TABLE "traspasos_tanque" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "origenId" TEXT,
    "destinoId" TEXT,
    "origenNumero" TEXT NOT NULL,
    "origenCiudadNombre" TEXT NOT NULL,
    "destinoNumero" TEXT NOT NULL,
    "destinoCiudadNombre" TEXT NOT NULL,
    "numeroSerieTanque" TEXT,
    "datos" TEXT NOT NULL,
    "registros" TEXT NOT NULL,
    "motivo" TEXT,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "traspasos_tanque_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "vehicle_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "traspasos_tanque_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "vehicle_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "traspasos_tanque_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "traspasos_tanque_origenId_idx" ON "traspasos_tanque"("origenId");
CREATE INDEX "traspasos_tanque_destinoId_idx" ON "traspasos_tanque"("destinoId");
CREATE INDEX "traspasos_tanque_userId_idx" ON "traspasos_tanque"("userId");
