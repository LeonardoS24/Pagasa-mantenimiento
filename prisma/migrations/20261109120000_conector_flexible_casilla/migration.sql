-- AlterTable: casilla «¿tiene conector flexible?» de la ficha.
ALTER TABLE "vehicle_technical_sheets" ADD COLUMN "tieneConectorFlexible" BOOLEAN NOT NULL DEFAULT false;

-- Las fichas que ya traían la fecha del conector quedan con la casilla marcada.
UPDATE "vehicle_technical_sheets" SET "tieneConectorFlexible" = true
WHERE "fechaFabricacionConectorFlexible" IS NOT NULL;
