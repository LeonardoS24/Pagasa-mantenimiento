-- CreateTable
CREATE TABLE "Mensaje" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canal" TEXT NOT NULL,
    "deUserId" TEXT,
    "deUsername" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Mensaje_deUserId_fkey" FOREIGN KEY ("deUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LecturaCanal" (
    "userId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "leidoHasta" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "canal"),
    CONSTRAINT "LecturaCanal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_configuracion_reportes" (
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
    "avisoRojoActivo" BOOLEAN NOT NULL DEFAULT false,
    "avisoRojoUltimoDia" TEXT,
    "avisoRojoNotificados" TEXT NOT NULL DEFAULT '[]',
    "avisoRojoUltimoResumen" TEXT,
    "actualizadoPor" TEXT,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_configuracion_reportes" ("activo", "actualizadoPor", "destinatarios", "diaSemana", "diasAnticipacion", "hora", "id", "remitente", "smtpClaveCifrada", "smtpHost", "smtpPuerto", "smtpSeguro", "smtpUsuario", "ultimoEnvio", "ultimoError", "ultimoIntento", "ultimoResumen", "updatedAt") SELECT "activo", "actualizadoPor", "destinatarios", "diaSemana", "diasAnticipacion", "hora", "id", "remitente", "smtpClaveCifrada", "smtpHost", "smtpPuerto", "smtpSeguro", "smtpUsuario", "ultimoEnvio", "ultimoError", "ultimoIntento", "ultimoResumen", "updatedAt" FROM "configuracion_reportes";
DROP TABLE "configuracion_reportes";
ALTER TABLE "new_configuracion_reportes" RENAME TO "configuracion_reportes";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Mensaje_canal_createdAt_idx" ON "Mensaje"("canal", "createdAt");
