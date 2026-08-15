-- AlterTable
-- Grupo al que pertenece una categoría de pieza agregada desde el panel de
-- administración ("UNIDADES" | "ESTACIONES"). null en las aprendidas solas.
ALTER TABLE "learned_pieces" ADD COLUMN "grupo" TEXT;
