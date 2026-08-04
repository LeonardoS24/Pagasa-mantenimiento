/*
  Warnings:

  - You are about to drop the column `serieTanque` on the `vehicle_technical_sheets` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_vehicle_technical_sheets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
    "fabricante" TEXT,
    "marca" TEXT,
    "linea" TEXT,
    "modelo" TEXT,
    "peso" TEXT,
    "pesoBrutoVacio" TEXT,
    "pesoBrutoMaximo" TEXT,
    "serie" TEXT,
    "combustible" TEXT,
    "caracteristicas" TEXT,
    "ubicacion" TEXT,
    "potencia" TEXT,
    "horasUsoDiario" TEXT,
    "fechaAdquisicion" DATETIME,
    "capacidadTanque" TEXT,
    "marcaTanque" TEXT,
    "anioFabricacionTanque" TEXT,
    "fechaFabricacionTanque" DATETIME,
    "numeroSerieTanque" TEXT,
    "numeroUltimoUltrasonido" TEXT,
    "ultimoUltrasonido" DATETIME,
    "fechaProximoUltrasonido" DATETIME,
    "numeroUltimaInspeccionVisual" TEXT,
    "ultimaInspeccionVisual" DATETIME,
    "fechaProximaInspeccionVisual" DATETIME,
    "numeroUltimaPruebaHermeticidad" TEXT,
    "ultimaPruebaHermeticidad" DATETIME,
    "fechaProximaPruebaHermeticidad" DATETIME,
    "numeroUltimaInspeccionVisualInterna" TEXT,
    "ultimaInspeccionVisualInterna" DATETIME,
    "fechaProximaInspeccionVisualInterna" DATETIME,
    "numeroUltimaPruebaHidrostatica" TEXT,
    "ultimaPruebaHidrostatica" DATETIME,
    "fechaProximaPruebaHidrostatica" DATETIME,
    "fechaInstalacionExtintor" DATETIME,
    "fechaVencimientoExtintor" DATETIME,
    "calidadExtintor" TEXT,
    "fechaCalidadMalaExtintor" DATETIME,
    "kilometrajeUltimoMantenimiento" INTEGER,
    "fechaUltimoMantenimiento" DATETIME,
    "kilometrajeProximoMantenimiento" INTEGER,
    "fechaProximoMantenimiento" DATETIME,
    "fechaInstalacionValvulas" DATETIME,
    "fechaFabricacionValvulaLlenado" DATETIME,
    "fechaFabricacionValvulaServicio" DATETIME,
    "fechaFabricacionValvulaMaximoLlenado" DATETIME,
    "fechaFabricacionValvulaAlivio" DATETIME,
    "fechaInstalacionMangueras" DATETIME,
    "fechaFabricacionManguera" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vehicle_technical_sheets_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_vehicle_technical_sheets" ("anioFabricacionTanque", "calidadExtintor", "capacidadTanque", "caracteristicas", "combustible", "createdAt", "fabricante", "fechaAdquisicion", "fechaCalidadMalaExtintor", "fechaFabricacionManguera", "fechaFabricacionTanque", "fechaFabricacionValvulaAlivio", "fechaFabricacionValvulaLlenado", "fechaFabricacionValvulaMaximoLlenado", "fechaFabricacionValvulaServicio", "fechaInstalacionExtintor", "fechaInstalacionMangueras", "fechaInstalacionValvulas", "fechaProximaInspeccionVisual", "fechaProximaInspeccionVisualInterna", "fechaProximaPruebaHermeticidad", "fechaProximaPruebaHidrostatica", "fechaProximoMantenimiento", "fechaProximoUltrasonido", "fechaUltimoMantenimiento", "fechaVencimientoExtintor", "horasUsoDiario", "id", "kilometrajeProximoMantenimiento", "kilometrajeUltimoMantenimiento", "linea", "marca", "marcaTanque", "modelo", "numeroSerieTanque", "numeroUltimaInspeccionVisual", "numeroUltimaInspeccionVisualInterna", "numeroUltimaPruebaHermeticidad", "numeroUltimaPruebaHidrostatica", "numeroUltimoUltrasonido", "peso", "pesoBrutoMaximo", "pesoBrutoVacio", "potencia", "serie", "ubicacion", "ultimaInspeccionVisual", "ultimaInspeccionVisualInterna", "ultimaPruebaHermeticidad", "ultimaPruebaHidrostatica", "ultimoUltrasonido", "updatedAt", "vehicleRecordId") SELECT "anioFabricacionTanque", "calidadExtintor", "capacidadTanque", "caracteristicas", "combustible", "createdAt", "fabricante", "fechaAdquisicion", "fechaCalidadMalaExtintor", "fechaFabricacionManguera", "fechaFabricacionTanque", "fechaFabricacionValvulaAlivio", "fechaFabricacionValvulaLlenado", "fechaFabricacionValvulaMaximoLlenado", "fechaFabricacionValvulaServicio", "fechaInstalacionExtintor", "fechaInstalacionMangueras", "fechaInstalacionValvulas", "fechaProximaInspeccionVisual", "fechaProximaInspeccionVisualInterna", "fechaProximaPruebaHermeticidad", "fechaProximaPruebaHidrostatica", "fechaProximoMantenimiento", "fechaProximoUltrasonido", "fechaUltimoMantenimiento", "fechaVencimientoExtintor", "horasUsoDiario", "id", "kilometrajeProximoMantenimiento", "kilometrajeUltimoMantenimiento", "linea", "marca", "marcaTanque", "modelo", "numeroSerieTanque", "numeroUltimaInspeccionVisual", "numeroUltimaInspeccionVisualInterna", "numeroUltimaPruebaHermeticidad", "numeroUltimaPruebaHidrostatica", "numeroUltimoUltrasonido", "peso", "pesoBrutoMaximo", "pesoBrutoVacio", "potencia", "serie", "ubicacion", "ultimaInspeccionVisual", "ultimaInspeccionVisualInterna", "ultimaPruebaHermeticidad", "ultimaPruebaHidrostatica", "ultimoUltrasonido", "updatedAt", "vehicleRecordId" FROM "vehicle_technical_sheets";
DROP TABLE "vehicle_technical_sheets";
ALTER TABLE "new_vehicle_technical_sheets" RENAME TO "vehicle_technical_sheets";
CREATE UNIQUE INDEX "vehicle_technical_sheets_vehicleRecordId_key" ON "vehicle_technical_sheets"("vehicleRecordId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
