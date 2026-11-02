-- CreateTable
CREATE TABLE "almacen_config" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cityId" TEXT NOT NULL,
    "urlHoja" TEXT,
    "ultimaLectura" DATETIME,
    "ultimoError" TEXT,
    "pendiente" TEXT,
    "pendienteHuella" TEXT,
    "pendienteEl" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "almacen_config_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "almacen_articulos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cityId" TEXT NOT NULL,
    "clave" TEXT NOT NULL,
    "codigo" TEXT,
    "articulo" TEXT NOT NULL,
    "categoria" TEXT,
    "marca" TEXT,
    "unidad" TEXT,
    "ubicacion" TEXT,
    "cantidad" REAL,
    "disponibles" REAL,
    "prestadoA" TEXT,
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "almacen_articulos_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "almacen_movimientos" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cityId" TEXT NOT NULL,
    "huella" TEXT NOT NULL,
    "repeticion" INTEGER NOT NULL DEFAULT 0,
    "fecha" DATETIME,
    "fechaTexto" TEXT,
    "movimiento" TEXT,
    "articulo" TEXT NOT NULL,
    "cantidad" REAL,
    "trabajador" TEXT,
    "paraQue" TEXT,
    "notas" TEXT,
    "unidad" TEXT,
    "vehicleRecordId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "almacen_movimientos_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "almacen_movimientos_vehicleRecordId_fkey" FOREIGN KEY ("vehicleRecordId") REFERENCES "vehicle_records" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "almacen_config_cityId_key" ON "almacen_config"("cityId");

-- CreateIndex
CREATE INDEX "almacen_articulos_cityId_idx" ON "almacen_articulos"("cityId");

-- CreateIndex
CREATE UNIQUE INDEX "almacen_articulos_cityId_clave_key" ON "almacen_articulos"("cityId", "clave");

-- CreateIndex
CREATE INDEX "almacen_movimientos_vehicleRecordId_idx" ON "almacen_movimientos"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "almacen_movimientos_cityId_fecha_idx" ON "almacen_movimientos"("cityId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "almacen_movimientos_cityId_huella_repeticion_key" ON "almacen_movimientos"("cityId", "huella", "repeticion");

