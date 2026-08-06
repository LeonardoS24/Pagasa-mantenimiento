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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "equipos_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_equipos" ("anioFabricacion", "capacidad", "categoria", "claseAislamiento", "codigo", "combustible", "comunicacion", "consumoElectrico", "corriente", "createdAt", "criticidad", "estado", "fabricante", "fechaInstalacion", "fluidoTrabajo", "frecuenciaElectrica", "frecuenciaMantenimiento", "horasOperacion", "id", "lubricante", "marca", "materialFabricacion", "modelo", "nombre", "numeroFases", "numeroSerie", "observaciones", "order", "potencia", "presionTrabajo", "proteccionIp", "responsable", "rpm", "sectionId", "temperaturaOperacion", "tipoEquipo", "tipoEquipoDetalle", "ubicacion", "updatedAt", "voltaje") SELECT "anioFabricacion", "capacidad", "categoria", "claseAislamiento", "codigo", "combustible", "comunicacion", "consumoElectrico", "corriente", "createdAt", "criticidad", "estado", "fabricante", "fechaInstalacion", "fluidoTrabajo", "frecuenciaElectrica", "frecuenciaMantenimiento", "horasOperacion", "id", "lubricante", "marca", "materialFabricacion", "modelo", "nombre", "numeroFases", "numeroSerie", "observaciones", "order", "potencia", "presionTrabajo", "proteccionIp", "responsable", "rpm", "sectionId", "temperaturaOperacion", "tipoEquipo", "tipoEquipoDetalle", "ubicacion", "updatedAt", "voltaje" FROM "equipos";
DROP TABLE "equipos";
ALTER TABLE "new_equipos" RENAME TO "equipos";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
