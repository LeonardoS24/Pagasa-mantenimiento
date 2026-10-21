-- CreateTable
CREATE TABLE "requisitos_normativos_ajustes" (
    "clave" TEXT NOT NULL PRIMARY KEY,
    "plazoAnios" INTEGER,
    "norma" TEXT,
    "numeral" TEXT,
    "cita" TEXT,
    "verificado" BOOLEAN,
    "actualizadoPor" TEXT,
    "updatedAt" DATETIME NOT NULL
);
