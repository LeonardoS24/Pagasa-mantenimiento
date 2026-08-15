-- AlterTable
-- La válvula de relevo hidrostático va montada en la tubería, no en el
-- tanque: no es parte del juego de válvulas del recipiente ni de su ciclo de
-- reemplazo, así que sale del registro (ver lib/station-valves.ts).
ALTER TABLE "station_tank_technical_sheets" DROP COLUMN "fechaFabricacionValvulaRelevoHidrostatico";
