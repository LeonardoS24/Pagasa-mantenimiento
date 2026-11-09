-- Casilla «¿tiene bitácora de mantenimiento del tanque y de las válvulas?» de
-- la ficha del tanque de una estación (lib/station-valves.ts).
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "tieneBitacoraMantenimientoValvulas" BOOLEAN NOT NULL DEFAULT false;

-- Textos del catálogo que el ADMIN puede cambiar y requisito quitado.
ALTER TABLE "requisitos_normativos_ajustes" ADD COLUMN "nombre" TEXT;
ALTER TABLE "requisitos_normativos_ajustes" ADD COLUMN "aplicaA" TEXT;
ALTER TABLE "requisitos_normativos_ajustes" ADD COLUMN "cuentaDesde" TEXT;
ALTER TABLE "requisitos_normativos_ajustes" ADD COLUMN "nota" TEXT;
ALTER TABLE "requisitos_normativos_ajustes" ADD COLUMN "oculto" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "requisitos_propios" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "aplicaA" TEXT NOT NULL,
    "norma" TEXT NOT NULL,
    "numeral" TEXT NOT NULL,
    "cita" TEXT NOT NULL,
    "cuentaDesde" TEXT NOT NULL,
    "nota" TEXT,
    "verificado" BOOLEAN NOT NULL DEFAULT false,
    "plazoAnios" INTEGER,
    "creadoPor" TEXT,
    "actualizadoPor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "alertas_ajustes" (
    "tipo" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "actualizadoPor" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "alertas_propias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "apartados" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "fuenteClave" TEXT NOT NULL,
    "modo" TEXT NOT NULL DEFAULT 'PLAZO',
    "plazoAnios" INTEGER NOT NULL DEFAULT 0,
    "plazoMeses" INTEGER NOT NULL DEFAULT 0,
    "diasAviso" INTEGER NOT NULL DEFAULT 30,
    "requisitoClave" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadoPor" TEXT,
    "actualizadoPor" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
