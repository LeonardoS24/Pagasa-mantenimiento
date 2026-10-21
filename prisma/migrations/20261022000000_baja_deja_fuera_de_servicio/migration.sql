-- Una unidad dada de baja está fuera de servicio. Las bajas anteriores a este
-- cambio podían haberse quedado como "Operativa" o "En taller"; se alinean.
-- Solo cambia el estatus operativo: no se toca ninguna bitácora ni documento.
UPDATE "vehicle_records" SET "estatus" = 'FUERA_DE_SERVICIO' WHERE "activo" = 0 AND "estatus" <> 'FUERA_DE_SERVICIO';
