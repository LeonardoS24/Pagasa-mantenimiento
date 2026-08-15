-- AlterTable
-- "responsable" se divide en dos: quien hizo el cambio/instalación y quien
-- lo supervisó. El dato que hubiera se conserva como responsable de cambio
-- (era el sentido original del campo).
ALTER TABLE "valve_change_logs" RENAME COLUMN "responsable" TO "responsableCambio";
ALTER TABLE "valve_change_logs" ADD COLUMN "responsableSupervision" TEXT;
