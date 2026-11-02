import type { ItemLote } from "@/lib/lote-documentos";
import { createUltrasoundLog } from "@/actions/ultrasound-actions";
import { createVisualInspectionLog } from "@/actions/visual-inspection-actions";
import { createTightnessTestLog } from "@/actions/tightness-test-actions";
import { createInternalVisualInspectionLog } from "@/actions/internal-visual-inspection-actions";
import { createHydrostaticTestLog } from "@/actions/hydrostatic-test-actions";
import { createMaintenanceLog } from "@/actions/maintenance-actions";
import { createExtinguisherChangeLog } from "@/actions/extinguisher-actions";
import { createHoseChangeLog } from "@/actions/hose-actions";
import { createInsurancePolicyLog } from "@/actions/insurance-policy-actions";
import { uploadVehicleDocument } from "@/actions/document-actions";
import type { ActionState } from "@/actions/user-actions";

// Cómo se guarda un registro de bitácora a partir de un ItemLote: lo comparten
// la carga de documentos escaneados y el registro en lote. Siempre se llama a
// la MISMA acción que usa el formulario de la bitácora, así que hereda sus
// validaciones, la revisión de acceso a la ciudad y la actualización de la ficha.

// El FormData que espera la acción de cada bitácora, con los nombres de
// campo de su propio formulario (components/admin/Create*Form.tsx). El
// archivo es opcional: las bitácoras aceptan el registro sin PDF.
export function formularioDeBitacora(item: ItemLote, archivo?: File): FormData {
  const fd = new FormData();
  const poner = (nombre: string, valor: string | null) => fd.set(nombre, valor ?? "");
  switch (item.tipo) {
    case "ULTRASONIDO":
      poner("compania", item.compania);
      poner("numeroUltrasonido", item.numero);
      poner("responsable", item.responsable);
      poner("fechaUltimoUltrasonido", item.fechaAnterior);
      poner("fechaRealizacion", item.fechaRealizacion);
      break;
    case "VISUAL_EXTERNA":
    case "VISUAL_INTERNA":
      poner("compania", item.compania);
      poner("numeroInspeccion", item.numero);
      poner("responsable", item.responsable);
      poner("fechaUltimaInspeccion", item.fechaAnterior);
      poner("fechaRealizacion", item.fechaRealizacion);
      if (item.tipo === "VISUAL_EXTERNA") poner("fechaProximaInspeccion", item.fechaProxima);
      break;
    case "HERMETICIDAD":
    case "HIDROSTATICA":
      poner("compania", item.compania);
      poner("numeroPrueba", item.numero);
      poner("responsable", item.responsable);
      poner("fechaUltimaPrueba", item.fechaAnterior);
      poner("fechaRealizacion", item.fechaRealizacion);
      if (item.tipo === "HERMETICIDAD") poner("fechaProximaPrueba", item.fechaProxima);
      break;
    case "MANTENIMIENTO":
      poner("tipoMantenimiento", item.tipoMantenimiento);
      poner("tipoServicio", item.tipoServicio);
      poner("calidad", item.calidad);
      poner("fecha", item.fechaRealizacion);
      poner("kilometraje", item.kilometraje);
      poner("responsableTrabajoMecanico", item.responsable);
      poner("estatus", item.estatus);
      poner("descripcion", item.descripcion);
      poner("observacion", item.observaciones);
      break;
    case "EXTINTOR":
      poner("responsable", item.responsable);
      poner("fechaInstalacion", item.fechaRealizacion);
      poner("fechaVencimiento", item.fechaVencimiento);
      poner("calidad", item.calidad);
      break;
    case "MANGUERAS":
      poner("responsable", item.responsable);
      poner("fechaInstalacion", item.fechaRealizacion);
      poner("fechaFabricacionManguera", item.fechaFabricacion);
      break;
    case "POLIZA":
      poner("aseguradora", item.compania);
      poner("numeroPoliza", item.numero);
      poner("fechaRealizacion", item.fechaRealizacion);
      poner("fechaVencimiento", item.fechaVencimiento);
      poner("observaciones", item.observaciones);
      break;
    case "UNIDAD":
      break;
  }
  if (archivo) {
    // "Otro documento de la unidad" se sube con uploadVehicleDocument, que
    // espera un solo archivo en "file"; las bitácoras aceptan varios en "files".
    fd.append(item.tipo === "UNIDAD" ? "file" : "files", archivo);
  }
  return fd;
}

export function guardarEnBitacora(item: ItemLote, vehicleId: string, tanqueId: string | null, fd: FormData) {
  const sinEstado: ActionState = {};
  switch (item.tipo) {
    case "ULTRASONIDO":
      return createUltrasoundLog(vehicleId, tanqueId, sinEstado, fd);
    case "VISUAL_EXTERNA":
      return createVisualInspectionLog(vehicleId, tanqueId, sinEstado, fd);
    case "HERMETICIDAD":
      return createTightnessTestLog(vehicleId, tanqueId, sinEstado, fd);
    case "VISUAL_INTERNA":
      return createInternalVisualInspectionLog(vehicleId, tanqueId, sinEstado, fd);
    case "HIDROSTATICA":
      return createHydrostaticTestLog(vehicleId, tanqueId, sinEstado, fd);
    case "MANTENIMIENTO":
      return createMaintenanceLog(vehicleId, sinEstado, fd);
    case "EXTINTOR":
      return createExtinguisherChangeLog(vehicleId, sinEstado, fd);
    case "MANGUERAS":
      return createHoseChangeLog(vehicleId, sinEstado, fd);
    case "POLIZA":
      return createInsurancePolicyLog(vehicleId, sinEstado, fd);
    case "UNIDAD":
      return uploadVehicleDocument(vehicleId, sinEstado, fd);
  }
}
