-- CreateTable
CREATE TABLE "configuracion_reportes" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'unico',
    "activo" BOOLEAN NOT NULL DEFAULT false,
    "destinatarios" TEXT NOT NULL DEFAULT '',
    "diaSemana" INTEGER NOT NULL DEFAULT 1,
    "hora" INTEGER NOT NULL DEFAULT 7,
    "diasAnticipacion" INTEGER NOT NULL DEFAULT 30,
    "smtpHost" TEXT,
    "smtpPuerto" INTEGER NOT NULL DEFAULT 465,
    "smtpSeguro" BOOLEAN NOT NULL DEFAULT true,
    "smtpUsuario" TEXT,
    "smtpClaveCifrada" TEXT,
    "remitente" TEXT,
    "ultimoIntento" DATETIME,
    "ultimoEnvio" DATETIME,
    "ultimoError" TEXT,
    "ultimoResumen" TEXT,
    "actualizadoPor" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ajustes_sistema" (
    "clave" TEXT NOT NULL PRIMARY KEY,
    "valor" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);
