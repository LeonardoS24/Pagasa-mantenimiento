-- AlterTable
ALTER TABLE "SesionActiva" ADD COLUMN "ip" TEXT;
ALTER TABLE "SesionActiva" ADD COLUMN "navegador" TEXT;

-- CreateTable
CREATE TABLE "RegistroAcceso" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evento" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "actorUsername" TEXT,
    "ip" TEXT,
    "navegador" TEXT,
    "detalle" TEXT,
    CONSTRAINT "RegistroAcceso_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USUARIO',
    "puesto" TEXT,
    "avisosMantenimientoActivos" BOOLEAN NOT NULL DEFAULT true,
    "accesoAmpliadoDias" TEXT,
    "accesoAmpliadoHoraInicio" TEXT,
    "accesoAmpliadoHoraFin" TEXT,
    "intentosFallidosLogin" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" DATETIME,
    "debeCambiarContrasena" BOOLEAN NOT NULL DEFAULT false,
    "contrasenaCambiadaEl" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("accesoAmpliadoDias", "accesoAmpliadoHoraFin", "accesoAmpliadoHoraInicio", "avisosMantenimientoActivos", "bloqueadoHasta", "createdAt", "id", "intentosFallidosLogin", "passwordHash", "puesto", "role", "updatedAt", "username") SELECT "accesoAmpliadoDias", "accesoAmpliadoHoraFin", "accesoAmpliadoHoraInicio", "avisosMantenimientoActivos", "bloqueadoHasta", "createdAt", "id", "intentosFallidosLogin", "passwordHash", "puesto", "role", "updatedAt", "username" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RegistroAcceso_createdAt_idx" ON "RegistroAcceso"("createdAt");

-- CreateIndex
CREATE INDEX "RegistroAcceso_userId_createdAt_idx" ON "RegistroAcceso"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RegistroAcceso_ip_createdAt_idx" ON "RegistroAcceso"("ip", "createdAt");
