-- CreateTable
CREATE TABLE "vehicle_technical_sheets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "fabricante" TEXT,
    "marca" TEXT,
    "linea" TEXT,
    "modelo" TEXT,
    "peso" TEXT,
    "serie" TEXT,
    "combustible" TEXT,
    "caracteristicas" TEXT,
    "ubicacion" TEXT,
    "potencia" TEXT,
    "horasUsoDiario" TEXT,
    "fechaAdquisicion" DATETIME,
    "serieTanque" TEXT,
    "capacidadTanque" TEXT,
    "marcaTanque" TEXT,
    "anioFabricacionTanque" TEXT,
    "numeroSerieTanque" TEXT,
    "ultimoUltrasonido" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vehicle_technical_sheets_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "maintenance_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "tipoMantenimiento" TEXT NOT NULL,
    "tipoServicio" TEXT NOT NULL,
    "cantidad" TEXT,
    "unidad" TEXT,
    "descripcion" TEXT,
    "observacion" TEXT,
    "fecha" DATETIME NOT NULL,
    "nombreOperador" TEXT,
    "auxiliarTecnico" TEXT,
    "responsableTrabajoMecanico" TEXT,
    "estatus" TEXT NOT NULL DEFAULT 'SIN_ATENCION',
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "maintenance_logs_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "maintenance_logs_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_technical_sheets_vehicleRecordId_key" ON "vehicle_technical_sheets"("vehicleRecordId");
