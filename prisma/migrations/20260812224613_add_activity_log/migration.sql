-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "resumen" TEXT NOT NULL,
    "detalle" TEXT,
    "citySlug" TEXT,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_log_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
