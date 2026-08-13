-- AlterTable
-- Se quita "fabricante" de la ficha técnica del vehículo/auto por pedido
-- del usuario: la sección "Automóvil" ya identifica la unidad con el
-- catálogo Marca/Línea/Modelo (ver lib/vehicle-brand-catalog.ts), así que
-- este campo quedaba de más. Solo 4 de 328 fichas técnicas tenían algo
-- escrito aquí.
ALTER TABLE "vehicle_technical_sheets" DROP COLUMN "fabricante";
