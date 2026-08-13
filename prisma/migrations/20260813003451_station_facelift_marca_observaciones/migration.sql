-- AlterTable
ALTER TABLE "vehicle_records" ADD COLUMN "observaciones" TEXT;
ALTER TABLE "vehicle_records" DROP COLUMN "numeroAnterior";
ALTER TABLE "vehicle_records" DROP COLUMN "localidadAnterior";
