/*
  Warnings:

  - You are about to drop the column `placaAnio` on the `vehicle_technical_sheets` table. All the data in the column will be lost.
  - You are about to drop the column `placaCapacidadNominalAgua` on the `vehicle_technical_sheets` table. All the data in the column will be lost.
  - You are about to drop the column `placaNumeroSerie` on the `vehicle_technical_sheets` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_vehicle_technical_sheets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "vehicleRecordId" TEXT NOT NULL,
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
    "chofer" TEXT,
    "numeroPoliza" TEXT,
    "inciso" TEXT,
    "capacidadTanque" TEXT,
    "marcaTanque" TEXT,
    "anioFabricacionTanque" TEXT,
    "fechaFabricacionTanque" DATETIME,
    "numeroSerieTanque" TEXT,
    "placaPresionMaximaTrabajo" TEXT,
    "placaTemperaturaDiseno" TEXT,
    "placaCabezales" TEXT,
    "placaDiametroExterior" TEXT,
    "placaLongitudTotal" TEXT,
    "placaEspesorMinPlacaCuerpo" TEXT,
    "placaMaterialCuerpo" TEXT,
    "placaEspesorMinPlacaCabeza" TEXT,
    "placaMaterialCabeza" TEXT,
    "placaNormaFabricacion" TEXT,
    "placaDT" TEXT,
    "placaNumeroSeriePropietario" TEXT,
    "placaCapacidadPorcentaje" TEXT,
    "placaCapacidadKg" TEXT,
    "placaTara" TEXT,
    "placaRayosXCuerpo" TEXT,
    "placaRelevo" TEXT,
    "placaRayosXCabeza" TEXT,
    "placaPresionDiseno" TEXT,
    "placaFechaPruebaOriginal" TEXT,
    "placaPresionMaximaVapor" TEXT,
    "placaContenido" TEXT,
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
    "fechaFabricacionValvulaNoRetroceso" DATETIME,
    "fechaFabricacionValvulaBypass" DATETIME,
    "fechaFabricacionValvulaRetornoVapores" DATETIME,
    "fechaFabricacionValvulaServicio" DATETIME,
    "fechaFabricacionValvulaMaximoLlenado" DATETIME,
    "tieneValvulaMaximoLlenado85" BOOLEAN NOT NULL DEFAULT false,
    "fechaFabricacionValvulaMaximoLlenado85" DATETIME,
    "fechaFabricacionValvulaAlivio" DATETIME,
    "fechaFabricacionValvulaDescargaEmergencia" DATETIME,
    "fechaInstalacionMangueras" DATETIME,
    "fechaFabricacionManguera" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vehicle_technical_sheets_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_vehicle_technical_sheets" ("anioFabricacionTanque", "calidadExtintor", "capacidadTanque", "caracteristicas", "chofer", "combustible", "createdAt", "fechaAdquisicion", "fechaCalidadMalaExtintor", "fechaFabricacionManguera", "fechaFabricacionTanque", "fechaFabricacionValvulaAlivio", "fechaFabricacionValvulaBypass", "fechaFabricacionValvulaDescargaEmergencia", "fechaFabricacionValvulaLlenado", "fechaFabricacionValvulaMaximoLlenado", "fechaFabricacionValvulaMaximoLlenado85", "fechaFabricacionValvulaNoRetroceso", "fechaFabricacionValvulaRetornoVapores", "fechaFabricacionValvulaServicio", "fechaInstalacionExtintor", "fechaInstalacionMangueras", "fechaInstalacionValvulas", "fechaProximaInspeccionVisual", "fechaProximaInspeccionVisualInterna", "fechaProximaPruebaHermeticidad", "fechaProximaPruebaHidrostatica", "fechaProximoMantenimiento", "fechaProximoUltrasonido", "fechaUltimoMantenimiento", "fechaVencimientoExtintor", "horasUsoDiario", "id", "inciso", "kilometrajeProximoMantenimiento", "kilometrajeUltimoMantenimiento", "linea", "marca", "marcaTanque", "modelo", "numeroPoliza", "numeroSerieTanque", "numeroUltimaInspeccionVisual", "numeroUltimaInspeccionVisualInterna", "numeroUltimaPruebaHermeticidad", "numeroUltimaPruebaHidrostatica", "numeroUltimoUltrasonido", "peso", "pesoBrutoMaximo", "pesoBrutoVacio", "placaCabezales", "placaCapacidadKg", "placaCapacidadPorcentaje", "placaContenido", "placaDT", "placaDiametroExterior", "placaEspesorMinPlacaCabeza", "placaEspesorMinPlacaCuerpo", "placaFechaPruebaOriginal", "placaLongitudTotal", "placaMaterialCabeza", "placaMaterialCuerpo", "placaNormaFabricacion", "placaNumeroSeriePropietario", "placaPresionDiseno", "placaPresionMaximaTrabajo", "placaPresionMaximaVapor", "placaRayosXCabeza", "placaRayosXCuerpo", "placaRelevo", "placaTara", "placaTemperaturaDiseno", "potencia", "serie", "tieneValvulaMaximoLlenado85", "ubicacion", "ultimaInspeccionVisual", "ultimaInspeccionVisualInterna", "ultimaPruebaHermeticidad", "ultimaPruebaHidrostatica", "ultimoUltrasonido", "updatedAt", "vehicleRecordId") SELECT "anioFabricacionTanque", "calidadExtintor", "capacidadTanque", "caracteristicas", "chofer", "combustible", "createdAt", "fechaAdquisicion", "fechaCalidadMalaExtintor", "fechaFabricacionManguera", "fechaFabricacionTanque", "fechaFabricacionValvulaAlivio", "fechaFabricacionValvulaBypass", "fechaFabricacionValvulaDescargaEmergencia", "fechaFabricacionValvulaLlenado", "fechaFabricacionValvulaMaximoLlenado", "fechaFabricacionValvulaMaximoLlenado85", "fechaFabricacionValvulaNoRetroceso", "fechaFabricacionValvulaRetornoVapores", "fechaFabricacionValvulaServicio", "fechaInstalacionExtintor", "fechaInstalacionMangueras", "fechaInstalacionValvulas", "fechaProximaInspeccionVisual", "fechaProximaInspeccionVisualInterna", "fechaProximaPruebaHermeticidad", "fechaProximaPruebaHidrostatica", "fechaProximoMantenimiento", "fechaProximoUltrasonido", "fechaUltimoMantenimiento", "fechaVencimientoExtintor", "horasUsoDiario", "id", "inciso", "kilometrajeProximoMantenimiento", "kilometrajeUltimoMantenimiento", "linea", "marca", "marcaTanque", "modelo", "numeroPoliza", "numeroSerieTanque", "numeroUltimaInspeccionVisual", "numeroUltimaInspeccionVisualInterna", "numeroUltimaPruebaHermeticidad", "numeroUltimaPruebaHidrostatica", "numeroUltimoUltrasonido", "peso", "pesoBrutoMaximo", "pesoBrutoVacio", "placaCabezales", "placaCapacidadKg", "placaCapacidadPorcentaje", "placaContenido", "placaDT", "placaDiametroExterior", "placaEspesorMinPlacaCabeza", "placaEspesorMinPlacaCuerpo", "placaFechaPruebaOriginal", "placaLongitudTotal", "placaMaterialCabeza", "placaMaterialCuerpo", "placaNormaFabricacion", "placaNumeroSeriePropietario", "placaPresionDiseno", "placaPresionMaximaTrabajo", "placaPresionMaximaVapor", "placaRayosXCabeza", "placaRayosXCuerpo", "placaRelevo", "placaTara", "placaTemperaturaDiseno", "potencia", "serie", "tieneValvulaMaximoLlenado85", "ubicacion", "ultimaInspeccionVisual", "ultimaInspeccionVisualInterna", "ultimaPruebaHermeticidad", "ultimaPruebaHidrostatica", "ultimoUltrasonido", "updatedAt", "vehicleRecordId" FROM "vehicle_technical_sheets";
DROP TABLE "vehicle_technical_sheets";
ALTER TABLE "new_vehicle_technical_sheets" RENAME TO "vehicle_technical_sheets";
CREATE UNIQUE INDEX "vehicle_technical_sheets_vehicleRecordId_key" ON "vehicle_technical_sheets"("vehicleRecordId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
