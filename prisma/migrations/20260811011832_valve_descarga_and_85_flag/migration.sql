-- AlterTable: vehicle_technical_sheets
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "tieneValvulaMaximoLlenado85" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "fechaFabricacionValvulaDescargaEmergencia" DATETIME;

-- Backfill: si ya tenía la fecha de máximo llenado 85% capturada, marcar que sí la tiene.
UPDATE "vehicle_technical_sheets" SET "tieneValvulaMaximoLlenado85" = true WHERE "fechaFabricacionValvulaMaximoLlenado85" IS NOT NULL;

ALTER TABLE "vehicle_technical_sheets" DROP COLUMN "valvulaDescargaEmergencia";

-- AlterTable: valve_change_logs
ALTER TABLE "valve_change_logs" ADD COLUMN "tieneValvulaMaximoLlenado85" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "valve_change_logs" ADD COLUMN "fechaFabricacionValvulaDescargaEmergencia" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "valve_change_logs" SET "tieneValvulaMaximoLlenado85" = true WHERE "fechaFabricacionValvulaMaximoLlenado85" IS NOT NULL;

ALTER TABLE "valve_change_logs" DROP COLUMN "valvulaDescargaEmergencia";
