-- AlterTable: casilla «¿tiene acoplamiento de desconexión seca?» de la ficha.
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "tieneAcoplamientoSeco" BOOLEAN NOT NULL DEFAULT false;

-- Las fichas que ya traían fecha o número de serie quedan con la casilla marcada.
UPDATE "vehicle_technical_sheets" SET "tieneAcoplamientoSeco" = true
WHERE "fechaFabricacionAcoplamientoSeco" IS NOT NULL OR "codigoAcoplamientoSeco" IS NOT NULL;
