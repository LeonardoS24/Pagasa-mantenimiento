-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_equipos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sectionId" TEXT NOT NULL,
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
    CONSTRAINT "equipos_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_equipos" ("activo", "anioFabricacion", "capacidad", "categoria", "claseAislamiento", "codigo", "combustible", "comunicacion", "consumoElectrico", "corriente", "createdAt", "criticidad", "estado", "fabricante", "fechaBaja", "fechaInstalacion", "fluidoTrabajo", "frecuenciaElectrica", "frecuenciaMantenimiento", "horasOperacion", "id", "lubricante", "marca", "materialFabricacion", "modelo", "nombre", "numeroFases", "numeroSerie", "observaciones", "order", "potencia", "presionTrabajo", "proteccionIp", "responsable", "rpm", "sectionId", "temperaturaOperacion", "tipoEquipo", "tipoEquipoDetalle", "ubicacion", "updatedAt", "voltaje") SELECT "activo", "anioFabricacion", "capacidad", "categoria", "claseAislamiento", "codigo", "combustible", "comunicacion", "consumoElectrico", "corriente", "createdAt", "criticidad", "estado", "fabricante", "fechaBaja", "fechaInstalacion", "fluidoTrabajo", "frecuenciaElectrica", "frecuenciaMantenimiento", "horasOperacion", "id", "lubricante", "marca", "materialFabricacion", "modelo", "nombre", "numeroFases", "numeroSerie", "observaciones", "order", "potencia", "presionTrabajo", "proteccionIp", "responsable", "rpm", "sectionId", "temperaturaOperacion", "tipoEquipo", "tipoEquipoDetalle", "ubicacion", "updatedAt", "voltaje" FROM "equipos";
DROP TABLE "equipos";
ALTER TABLE "new_equipos" RENAME TO "equipos";
CREATE TABLE "new_vehicle_records" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sectionId" TEXT NOT NULL,
    "numeroEconomico" TEXT NOT NULL,
    "sucursal" TEXT NOT NULL,
    "anio" TEXT NOT NULL,
    "placas" TEXT NOT NULL,
    "numeroAnterior" TEXT,
    "localidadAnterior" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "fechaBaja" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vehicle_records_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "vehicle_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_vehicle_records" ("activo", "anio", "createdAt", "fechaBaja", "id", "localidadAnterior", "numeroAnterior", "numeroEconomico", "order", "placas", "sectionId", "sucursal", "updatedAt") SELECT "activo", "anio", "createdAt", "fechaBaja", "id", "localidadAnterior", "numeroAnterior", "numeroEconomico", "order", "placas", "sectionId", "sucursal", "updatedAt" FROM "vehicle_records";
DROP TABLE "vehicle_records";
ALTER TABLE "new_vehicle_records" RENAME TO "vehicle_records";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
