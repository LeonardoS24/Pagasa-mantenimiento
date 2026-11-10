-- Manguera de las estaciones de carburación (una por tanque), alerta a 7 años.
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaFabricacionManguera" DATETIME;
ALTER TABLE "station_tank_technical_sheets" ADD COLUMN "fechaInstalacionManguera" DATETIME;
