-- Equipo: dar de baja con motivo y equipo sustituto (ver Equipo.motivoBaja /
-- sustituidoPorId en schema.prisma)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_equipos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sectionId" TEXT NOT NULL,
    "vehicleRecordId" TEXT,
    "tipoEquipo" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaBaja" DATETIME,
    "motivoBaja" TEXT,
    "sustituidoPorId" TEXT,
    "codigo" TEXT,
    "nombre" TEXT NOT NULL,
    "categoria" TEXT,
    "tipoEquipoDetalle" TEXT,
    "marca" TEXT,
    "modelo" TEXT,
    "numeroSerie" TEXT,
    "fabricante" TEXT,
    "anioFabricacion" TEXT,
    "fechaInstalacion" DATETIME,
    "ubicacion" TEXT,
    "responsable" TEXT,
    "estado" TEXT,
    "criticidad" TEXT,
    "frecuenciaMantenimiento" TEXT,
    "observaciones" TEXT,
    "capacidad" TEXT,
    "presionTrabajo" TEXT,
    "temperaturaOperacion" TEXT,
    "materialFabricacion" TEXT,
    "fluidoTrabajo" TEXT,
    "potencia" TEXT,
    "rpm" TEXT,
    "lubricante" TEXT,
    "voltaje" TEXT,
    "corriente" TEXT,
    "frecuenciaElectrica" TEXT,
    "numeroFases" TEXT,
    "proteccionIp" TEXT,
    "claseAislamiento" TEXT,
    "consumoElectrico" TEXT,
    "comunicacion" TEXT,
    "combustible" TEXT,
    "horasOperacion" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "equipos_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "equipos_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "equipos_sustituidoPorId_fkey" FOREIGN KEY ("sustituidoPorId") REFERENCES "equipos" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "equipos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_equipos" ("id", "order", "sectionId", "vehicleRecordId", "tipoEquipo", "activo", "fechaBaja", "codigo", "nombre", "categoria", "tipoEquipoDetalle", "marca", "modelo", "numeroSerie", "fabricante", "anioFabricacion", "fechaInstalacion", "ubicacion", "responsable", "estado", "criticidad", "frecuenciaMantenimiento", "observaciones", "capacidad", "presionTrabajo", "temperaturaOperacion", "materialFabricacion", "fluidoTrabajo", "potencia", "rpm", "lubricante", "voltaje", "corriente", "frecuenciaElectrica", "numeroFases", "proteccionIp", "claseAislamiento", "consumoElectrico", "comunicacion", "combustible", "horasOperacion", "createdById", "createdAt", "updatedAt")
SELECT "id", "order", "sectionId", "vehicleRecordId", "tipoEquipo", "activo", "fechaBaja", "codigo", "nombre", "categoria", "tipoEquipoDetalle", "marca", "modelo", "numeroSerie", "fabricante", "anioFabricacion", "fechaInstalacion", "ubicacion", "responsable", "estado", "criticidad", "frecuenciaMantenimiento", "observaciones", "capacidad", "presionTrabajo", "temperaturaOperacion", "materialFabricacion", "fluidoTrabajo", "potencia", "rpm", "lubricante", "voltaje", "corriente", "frecuenciaElectrica", "numeroFases", "proteccionIp", "claseAislamiento", "consumoElectrico", "comunicacion", "combustible", "horasOperacion", "createdById", "createdAt", "updatedAt" FROM "equipos";
DROP TABLE "equipos";
ALTER TABLE "new_equipos" RENAME TO "equipos";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- StationTankTechnicalSheet: de 1 a N tanques por estación (ver
-- VehicleRecord.stationTankTechnicalSheets / etiqueta en schema.prisma).
-- No requiere reconstruir la tabla: solo cambia de "una columna única" a
-- "combinación única con etiqueta", y todas las filas ya existentes son
-- "Tanque 1" por el default.
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "etiqueta" TEXT NOT NULL DEFAULT 'Tanque 1';
DROP INDEX "station_tank_technical_sheets_vehicleRecordId_key";
CREATE UNIQUE INDEX "station_tank_technical_sheets_vehicleRecordId_etiqueta_key" ON "station_tank_technical_sheets"("vehicleRecordId", "etiqueta");
