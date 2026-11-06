-- AlterTable
ALTER TABLE "users" ADD COLUMN "totpSecreto" TEXT;
ALTER TABLE "users" ADD COLUMN "totpActivo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "totpPaso" INTEGER;
ALTER TABLE "users" ADD COLUMN "totpRespaldo" TEXT;
