-- AlterTable
ALTER TABLE "documents" ADD COLUMN "fecha" DATETIME;

-- AlterTable
ALTER TABLE "vehicle_records" ADD COLUMN "permisionaria" TEXT;
ALTER TABLE "vehicle_records" ADD COLUMN "permiso" TEXT;

-- CreateTable
CREATE TABLE "station_tank_technical_sheets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "numeroSerie" TEXT,
    "marca" TEXT,
    "modelo" TEXT,
    "tipo" TEXT,
    "anioFabricacion" TEXT,
    "fechaFabricacion" DATETIME,
    "capacidad" TEXT,
    "presionDiseno" TEXT,
    "longitudTotal" TEXT,
    "formaCabeza" TEXT,
    "espesorNominalCuerpo" TEXT,
    "espesorNominalCabeza" TEXT,
    "materialCuerpo" TEXT,
    "materialCabeza" TEXT,
    "diametroInterior" TEXT,
    "tara" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "station_tank_technical_sheets_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
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
    CONSTRAINT "equipos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_equipos" ("activo", "anioFabricacion", "capacidad", "categoria", "claseAislamiento", "codigo", "combustible", "comunicacion", "consumoElectrico", "corriente", "createdAt", "createdById", "criticidad", "estado", "fabricante", "fechaBaja", "fechaInstalacion", "fluidoTrabajo", "frecuenciaElectrica", "frecuenciaMantenimiento", "horasOperacion", "id", "lubricante", "marca", "materialFabricacion", "modelo", "nombre", "numeroFases", "numeroSerie", "observaciones", "order", "potencia", "presionTrabajo", "proteccionIp", "responsable", "rpm", "sectionId", "temperaturaOperacion", "tipoEquipo", "tipoEquipoDetalle", "ubicacion", "updatedAt", "voltaje") SELECT "activo", "anioFabricacion", "capacidad", "categoria", "claseAislamiento", "codigo", "combustible", "comunicacion", "consumoElectrico", "corriente", "createdAt", "createdById", "criticidad", "estado", "fabricante", "fechaBaja", "fechaInstalacion", "fluidoTrabajo", "frecuenciaElectrica", "frecuenciaMantenimiento", "horasOperacion", "id", "lubricante", "marca", "materialFabricacion", "modelo", "nombre", "numeroFases", "numeroSerie", "observaciones", "order", "potencia", "presionTrabajo", "proteccionIp", "responsable", "rpm", "sectionId", "temperaturaOperacion", "tipoEquipo", "tipoEquipoDetalle", "ubicacion", "updatedAt", "voltaje" FROM "equipos";
DROP TABLE "equipos";
ALTER TABLE "new_equipos" RENAME TO "equipos";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "station_tank_technical_sheets_vehicleRecordId_key" ON "station_tank_technical_sheets"("vehicleRecordId");
