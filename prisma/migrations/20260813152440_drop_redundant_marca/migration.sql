-- AlterTable
-- "marca" en vehicle_technical_sheets era un duplicado exacto de
-- vehicle_records.sucursal (322/323 coincidían byte a byte; el único
-- distinto, KG-161, tenía "?" aquí contra "Sin info." en sucursal, que ya
-- se conserva ahí) — se elimina sin migrar datos porque no había nada que
-- no estuviera ya en sucursal.
ALTER TABLE "vehicle_technical_sheets" DROP COLUMN "marca";
