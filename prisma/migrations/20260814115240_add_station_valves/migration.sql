-- AlterTable
-- Válvulas del tanque de una Estación/Planta (ver lib/station-valves.ts):
-- juego distinto al de un Auto-Tanque.
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaInstalacionValvulas" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaFabricacionValvulaExcesoFlujo" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaFabricacionValvulaNoRetroceso" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaFabricacionValvulaSeguridad" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaFabricacionValvulaLlenado" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaFabricacionValvulaServicio" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaFabricacionValvulaCheckLock" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaFabricacionValvulaRelevoHidrostatico" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaFabricacionValvulaVapor" DATETIME;
