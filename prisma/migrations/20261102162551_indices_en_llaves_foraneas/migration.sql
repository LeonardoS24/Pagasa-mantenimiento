-- CreateIndex
CREATE INDEX "LecturaCanal_userId_idx" ON "LecturaCanal"("userId");

-- CreateIndex
CREATE INDEX "Mensaje_deUserId_idx" ON "Mensaje"("deUserId");

-- CreateIndex
CREATE INDEX "activity_log_userId_idx" ON "activity_log"("userId");

-- CreateIndex
CREATE INDEX "compliance_checklist_items_updatedById_idx" ON "compliance_checklist_items"("updatedById");

-- CreateIndex
CREATE INDEX "conjunto_semirremolques_conjuntoId_idx" ON "conjunto_semirremolques"("conjuntoId");

-- CreateIndex
CREATE INDEX "conjuntos_transporte_cityId_idx" ON "conjuntos_transporte"("cityId");

-- CreateIndex
CREATE INDEX "conjuntos_transporte_tractocamionId_idx" ON "conjuntos_transporte"("tractocamionId");

-- CreateIndex
CREATE INDEX "custom_field_values_vehicleRecordId_idx" ON "custom_field_values"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "documents_sectionId_idx" ON "documents"("sectionId");

-- CreateIndex
CREATE INDEX "documents_vehicleRecordId_idx" ON "documents"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "documents_maintenanceLogId_idx" ON "documents"("maintenanceLogId");

-- CreateIndex
CREATE INDEX "documents_ultrasoundLogId_idx" ON "documents"("ultrasoundLogId");

-- CreateIndex
CREATE INDEX "documents_visualInspectionLogId_idx" ON "documents"("visualInspectionLogId");

-- CreateIndex
CREATE INDEX "documents_tightnessTestLogId_idx" ON "documents"("tightnessTestLogId");

-- CreateIndex
CREATE INDEX "documents_internalVisualInspectionLogId_idx" ON "documents"("internalVisualInspectionLogId");

-- CreateIndex
CREATE INDEX "documents_hydrostaticTestLogId_idx" ON "documents"("hydrostaticTestLogId");

-- CreateIndex
CREATE INDEX "documents_extinguisherChangeLogId_idx" ON "documents"("extinguisherChangeLogId");

-- CreateIndex
CREATE INDEX "documents_insurancePolicyLogId_idx" ON "documents"("insurancePolicyLogId");

-- CreateIndex
CREATE INDEX "documents_valveChangeLogId_idx" ON "documents"("valveChangeLogId");

-- CreateIndex
CREATE INDEX "documents_valveCorrectiveMaintenanceLogId_idx" ON "documents"("valveCorrectiveMaintenanceLogId");

-- CreateIndex
CREATE INDEX "documents_hoseChangeLogId_idx" ON "documents"("hoseChangeLogId");

-- CreateIndex
CREATE INDEX "documents_equipoId_idx" ON "documents"("equipoId");

-- CreateIndex
CREATE INDEX "documents_equipmentLogId_idx" ON "documents"("equipmentLogId");

-- CreateIndex
CREATE INDEX "documents_uploadedById_idx" ON "documents"("uploadedById");

-- CreateIndex
CREATE INDEX "equipment_logs_equipoId_idx" ON "equipment_logs"("equipoId");

-- CreateIndex
CREATE INDEX "equipment_logs_createdById_idx" ON "equipment_logs"("createdById");

-- CreateIndex
CREATE INDEX "equipos_sectionId_idx" ON "equipos"("sectionId");

-- CreateIndex
CREATE INDEX "equipos_vehicleRecordId_idx" ON "equipos"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "equipos_sustituidoPorId_idx" ON "equipos"("sustituidoPorId");

-- CreateIndex
CREATE INDEX "equipos_createdById_idx" ON "equipos"("createdById");

-- CreateIndex
CREATE INDEX "extinguisher_change_logs_vehicleRecordId_idx" ON "extinguisher_change_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "extinguisher_change_logs_createdById_idx" ON "extinguisher_change_logs"("createdById");

-- CreateIndex
CREATE INDEX "extinguisher_quality_change_logs_vehicleRecordId_idx" ON "extinguisher_quality_change_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "extinguisher_quality_change_logs_createdById_idx" ON "extinguisher_quality_change_logs"("createdById");

-- CreateIndex
CREATE INDEX "hose_change_logs_vehicleRecordId_idx" ON "hose_change_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "hose_change_logs_createdById_idx" ON "hose_change_logs"("createdById");

-- CreateIndex
CREATE INDEX "hydrostatic_test_logs_vehicleRecordId_idx" ON "hydrostatic_test_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "hydrostatic_test_logs_stationTankTechnicalSheetId_idx" ON "hydrostatic_test_logs"("stationTankTechnicalSheetId");

-- CreateIndex
CREATE INDEX "hydrostatic_test_logs_createdById_idx" ON "hydrostatic_test_logs"("createdById");

-- CreateIndex
CREATE INDEX "insurance_policy_logs_vehicleRecordId_idx" ON "insurance_policy_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "insurance_policy_logs_createdById_idx" ON "insurance_policy_logs"("createdById");

-- CreateIndex
CREATE INDEX "internal_visual_inspection_logs_vehicleRecordId_idx" ON "internal_visual_inspection_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "internal_visual_inspection_logs_stationTankTechnicalSheetId_idx" ON "internal_visual_inspection_logs"("stationTankTechnicalSheetId");

-- CreateIndex
CREATE INDEX "internal_visual_inspection_logs_createdById_idx" ON "internal_visual_inspection_logs"("createdById");

-- CreateIndex
CREATE INDEX "inventory_items_sectionId_idx" ON "inventory_items"("sectionId");

-- CreateIndex
CREATE INDEX "inventory_items_pieceOrderId_idx" ON "inventory_items"("pieceOrderId");

-- CreateIndex
CREATE INDEX "inventory_items_usedOnVehicleId_idx" ON "inventory_items"("usedOnVehicleId");

-- CreateIndex
CREATE INDEX "inventory_items_usedOnMaintenanceLogId_idx" ON "inventory_items"("usedOnMaintenanceLogId");

-- CreateIndex
CREATE INDEX "inventory_items_usedOnValveChangeLogId_idx" ON "inventory_items"("usedOnValveChangeLogId");

-- CreateIndex
CREATE INDEX "inventory_items_usedOnValveCorrectiveMaintenanceLogId_idx" ON "inventory_items"("usedOnValveCorrectiveMaintenanceLogId");

-- CreateIndex
CREATE INDEX "inventory_items_createdById_idx" ON "inventory_items"("createdById");

-- CreateIndex
CREATE INDEX "lotes_documentos_createdById_idx" ON "lotes_documentos"("createdById");

-- CreateIndex
CREATE INDEX "maintenance_logs_vehicleRecordId_idx" ON "maintenance_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "maintenance_logs_createdById_idx" ON "maintenance_logs"("createdById");

-- CreateIndex
CREATE INDEX "piece_orders_sectionId_idx" ON "piece_orders"("sectionId");

-- CreateIndex
CREATE INDEX "piece_orders_vehicleRecordId_idx" ON "piece_orders"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "piece_orders_sustituyeEquipoId_idx" ON "piece_orders"("sustituyeEquipoId");

-- CreateIndex
CREATE INDEX "piece_orders_createdById_idx" ON "piece_orders"("createdById");

-- CreateIndex
CREATE INDEX "seal_logs_vehicleRecordId_idx" ON "seal_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "seal_logs_createdById_idx" ON "seal_logs"("createdById");

-- CreateIndex
CREATE INDEX "seal_logs_deactivatedById_idx" ON "seal_logs"("deactivatedById");

-- CreateIndex
CREATE INDEX "sections_parentId_idx" ON "sections"("parentId");

-- CreateIndex
CREATE INDEX "tightness_test_logs_vehicleRecordId_idx" ON "tightness_test_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "tightness_test_logs_stationTankTechnicalSheetId_idx" ON "tightness_test_logs"("stationTankTechnicalSheetId");

-- CreateIndex
CREATE INDEX "tightness_test_logs_createdById_idx" ON "tightness_test_logs"("createdById");

-- CreateIndex
CREATE INDEX "ultrasound_logs_vehicleRecordId_idx" ON "ultrasound_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "ultrasound_logs_stationTankTechnicalSheetId_idx" ON "ultrasound_logs"("stationTankTechnicalSheetId");

-- CreateIndex
CREATE INDEX "ultrasound_logs_createdById_idx" ON "ultrasound_logs"("createdById");

-- CreateIndex
CREATE INDEX "user_city_access_cityId_idx" ON "user_city_access"("cityId");

-- CreateIndex
CREATE INDEX "valve_change_logs_vehicleRecordId_idx" ON "valve_change_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "valve_change_logs_createdById_idx" ON "valve_change_logs"("createdById");

-- CreateIndex
CREATE INDEX "valve_corrective_maintenance_logs_vehicleRecordId_idx" ON "valve_corrective_maintenance_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "valve_corrective_maintenance_logs_createdById_idx" ON "valve_corrective_maintenance_logs"("createdById");

-- CreateIndex
CREATE INDEX "vehicle_records_sectionId_idx" ON "vehicle_records"("sectionId");

-- CreateIndex
CREATE INDEX "vehicle_records_createdById_idx" ON "vehicle_records"("createdById");

-- CreateIndex
CREATE INDEX "visual_inspection_logs_vehicleRecordId_idx" ON "visual_inspection_logs"("vehicleRecordId");

-- CreateIndex
CREATE INDEX "visual_inspection_logs_stationTankTechnicalSheetId_idx" ON "visual_inspection_logs"("stationTankTechnicalSheetId");

-- CreateIndex
CREATE INDEX "visual_inspection_logs_createdById_idx" ON "visual_inspection_logs"("createdById");
