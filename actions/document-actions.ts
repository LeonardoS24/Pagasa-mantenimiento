"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import {
  saveDocumentFile,
  deleteDocumentFile,
  vehicleOwnerKey,
  maintenanceLogOwnerKey,
  ultrasoundLogOwnerKey,
  visualInspectionLogOwnerKey,
  tightnessTestLogOwnerKey,
  internalVisualInspectionLogOwnerKey,
  hydrostaticTestLogOwnerKey,
  extinguisherChangeLogOwnerKey,
  valveChangeLogOwnerKey,
  valveCorrectiveMaintenanceLogOwnerKey,
  hoseChangeLogOwnerKey,
  equipoOwnerKey,
  equipmentLogOwnerKey,
  MAX_DOCUMENT_SIZE,
} from "@/lib/documents";
import { getSectionChain, sectionBasePath } from "@/lib/section-path";
import type { ActionState } from "./user-actions";

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

// Solo "Programa de mantenimiento" y "Manuales" (ver uploadDocument):
// además de PDF e imagen, ahí se permiten documentos de oficina. El resto de
// apartados con documentos (unidades, bitácoras, equipos) se quedan solo con
// PDF/imagen.
const OFFICE_ALLOWED_SECTION_SLUGS = ["programa-de-mantenimiento", "manuales"];
const OFFICE_MIME_TYPES = [
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/csv",
  "text/plain",
];

function readPdfFromForm(
  formData: FormData,
  options?: { allowOfficeDocs?: boolean }
): File | { error: string } {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo." };
  }
  const esOffice = options?.allowOfficeDocs && OFFICE_MIME_TYPES.includes(file.type);
  if (file.type !== "application/pdf" && !IMAGE_MIME_TYPES.includes(file.type) && !esOffice) {
    return {
      error: options?.allowOfficeDocs
        ? "Solo se permiten archivos PDF, imágenes (JPG, PNG, WEBP) o de oficina (Word, Excel, PowerPoint, CSV, TXT)."
        : "Solo se permiten archivos PDF o imágenes (JPG, PNG, WEBP).",
    };
  }
  if (file.size > MAX_DOCUMENT_SIZE) {
    return { error: "El archivo supera el tamaño máximo permitido (20 MB)." };
  }
  return file;
}

export async function uploadDocument(
  sectionId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { city: true },
  });
  if (!section) {
    return { error: "El apartado no existe." };
  }

  const file = readPdfFromForm(formData, {
    allowOfficeDocs: OFFICE_ALLOWED_SECTION_SLUGS.includes(section.slug),
  });
  if (!(file instanceof File)) return file;

  const { storedName } = await saveDocumentFile(sectionId, file);

  await prisma.document.create({
    data: {
      sectionId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  const chain = await getSectionChain(sectionId);
  revalidatePath(sectionBasePath(section.city.slug, chain));
  return { success: "PDF subido correctamente." };
}

export async function uploadVehicleDocument(
  vehicleRecordId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleRecordId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(vehicleOwnerKey(vehicleRecordId), file);

  await prisma.document.create({
    data: {
      sectionId: vehicle.sectionId,
      vehicleRecordId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleRecordId}`);
  return { success: "PDF subido correctamente." };
}

// Registro de permisos de una Estación de carburación: a diferencia de
// uploadVehicleDocument (documentos generales, sin fecha propia), aquí se
// exige también la fecha en que se realizó/emitió el permiso — se guarda
// como Document con kind "PERMISO" para que quede aparte de la lista
// general de "Documentos" (ver DocumentList y el filtro por kind en la
// hoja de impresión).
export async function uploadStationPermit(
  vehicleRecordId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const fechaTexto = String(formData.get("fecha") ?? "").trim();
  if (!fechaTexto) {
    return { error: "La fecha del permiso es requerida." };
  }
  const fecha = new Date(fechaTexto);
  if (Number.isNaN(fecha.getTime())) {
    return { error: "Fecha inválida." };
  }

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleRecordId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(vehicleOwnerKey(vehicleRecordId), file);

  await prisma.document.create({
    data: {
      sectionId: vehicle.sectionId,
      vehicleRecordId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
      kind: "PERMISO",
      fecha,
    },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleRecordId}`);
  return { success: "Permiso subido correctamente." };
}

export async function uploadMaintenanceLogDocument(
  maintenanceLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const log = await prisma.maintenanceLog.findUnique({
    where: { id: maintenanceLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(maintenanceLogOwnerKey(maintenanceLogId), file);

  await prisma.document.create({
    data: {
      sectionId: log.vehicleRecord.sectionId,
      maintenanceLogId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "PDF subido correctamente." };
}

export async function uploadUltrasoundLogDocument(
  ultrasoundLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const log = await prisma.ultrasoundLog.findUnique({
    where: { id: ultrasoundLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(ultrasoundLogOwnerKey(ultrasoundLogId), file);

  await prisma.document.create({
    data: {
      sectionId: log.vehicleRecord.sectionId,
      ultrasoundLogId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "PDF subido correctamente." };
}

export async function uploadVisualInspectionLogDocument(
  visualInspectionLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const log = await prisma.visualInspectionLog.findUnique({
    where: { id: visualInspectionLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(
    visualInspectionLogOwnerKey(visualInspectionLogId),
    file
  );

  await prisma.document.create({
    data: {
      sectionId: log.vehicleRecord.sectionId,
      visualInspectionLogId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "PDF subido correctamente." };
}

export async function uploadTightnessTestLogDocument(
  tightnessTestLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const log = await prisma.tightnessTestLog.findUnique({
    where: { id: tightnessTestLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(tightnessTestLogOwnerKey(tightnessTestLogId), file);

  await prisma.document.create({
    data: {
      sectionId: log.vehicleRecord.sectionId,
      tightnessTestLogId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "PDF subido correctamente." };
}

export async function uploadInternalVisualInspectionLogDocument(
  internalVisualInspectionLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const log = await prisma.internalVisualInspectionLog.findUnique({
    where: { id: internalVisualInspectionLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(
    internalVisualInspectionLogOwnerKey(internalVisualInspectionLogId),
    file
  );

  await prisma.document.create({
    data: {
      sectionId: log.vehicleRecord.sectionId,
      internalVisualInspectionLogId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "PDF subido correctamente." };
}

export async function uploadHydrostaticTestLogDocument(
  hydrostaticTestLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const log = await prisma.hydrostaticTestLog.findUnique({
    where: { id: hydrostaticTestLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(
    hydrostaticTestLogOwnerKey(hydrostaticTestLogId),
    file
  );

  await prisma.document.create({
    data: {
      sectionId: log.vehicleRecord.sectionId,
      hydrostaticTestLogId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "PDF subido correctamente." };
}

export async function uploadExtinguisherChangeLogDocument(
  extinguisherChangeLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const log = await prisma.extinguisherChangeLog.findUnique({
    where: { id: extinguisherChangeLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(
    extinguisherChangeLogOwnerKey(extinguisherChangeLogId),
    file
  );

  await prisma.document.create({
    data: {
      sectionId: log.vehicleRecord.sectionId,
      extinguisherChangeLogId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "PDF subido correctamente." };
}

export async function uploadValveChangeLogDocument(
  valveChangeLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const log = await prisma.valveChangeLog.findUnique({
    where: { id: valveChangeLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(valveChangeLogOwnerKey(valveChangeLogId), file);

  await prisma.document.create({
    data: {
      sectionId: log.vehicleRecord.sectionId,
      valveChangeLogId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "PDF subido correctamente." };
}

export async function uploadValveCorrectiveMaintenanceLogDocument(
  valveCorrectiveMaintenanceLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const log = await prisma.valveCorrectiveMaintenanceLog.findUnique({
    where: { id: valveCorrectiveMaintenanceLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(
    valveCorrectiveMaintenanceLogOwnerKey(valveCorrectiveMaintenanceLogId),
    file
  );

  await prisma.document.create({
    data: {
      sectionId: log.vehicleRecord.sectionId,
      valveCorrectiveMaintenanceLogId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "PDF subido correctamente." };
}

export async function uploadHoseChangeLogDocument(
  hoseChangeLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const log = await prisma.hoseChangeLog.findUnique({
    where: { id: hoseChangeLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(hoseChangeLogOwnerKey(hoseChangeLogId), file);

  await prisma.document.create({
    data: {
      sectionId: log.vehicleRecord.sectionId,
      hoseChangeLogId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(
    `/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`
  );
  return { success: "PDF subido correctamente." };
}

export async function uploadEquipoDocument(
  equipoId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const equipo = await prisma.equipo.findUnique({
    where: { id: equipoId },
    include: { section: { include: { city: true } } },
  });
  if (!equipo) {
    return { error: "El equipo no existe." };
  }

  const { storedName } = await saveDocumentFile(equipoOwnerKey(equipoId), file);

  await prisma.document.create({
    data: {
      sectionId: equipo.sectionId,
      equipoId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(`/ciudades/${equipo.section.city.slug}/equipo/${equipoId}`);
  return { success: "PDF subido correctamente." };
}

export async function uploadEquipmentLogDocument(
  equipmentLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const log = await prisma.equipmentLog.findUnique({
    where: { id: equipmentLogId },
    include: { equipo: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  const { storedName } = await saveDocumentFile(equipmentLogOwnerKey(equipmentLogId), file);

  await prisma.document.create({
    data: {
      sectionId: log.equipo.sectionId,
      equipmentLogId,
      fileName: file.name,
      storedName,
      mimeType: file.type,
      size: file.size,
      uploadedById: editor.userId,
    },
  });

  revalidatePath(`/ciudades/${log.equipo.section.city.slug}/equipo/${log.equipoId}`);
  return { success: "PDF subido correctamente." };
}

export async function deleteDocument(
  documentId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    include: {
      section: { include: { city: true } },
      maintenanceLog: {
        include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
      },
      ultrasoundLog: {
        include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
      },
      visualInspectionLog: {
        include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
      },
      tightnessTestLog: {
        include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
      },
      internalVisualInspectionLog: {
        include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
      },
      hydrostaticTestLog: {
        include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
      },
      extinguisherChangeLog: {
        include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
      },
      valveChangeLog: {
        include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
      },
      valveCorrectiveMaintenanceLog: {
        include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
      },
      hoseChangeLog: {
        include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
      },
      equipo: { include: { section: { include: { city: true } } } },
      equipmentLog: { include: { equipo: { include: { section: { include: { city: true } } } } } },
    },
  });
  if (!document) {
    return { error: "El documento ya no existe." };
  }

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Documento",
    resumen: document.fileName,
    citySlug: document.section.city.slug,
  });

  const ownerKey = document.maintenanceLogId
    ? maintenanceLogOwnerKey(document.maintenanceLogId)
    : document.ultrasoundLogId
      ? ultrasoundLogOwnerKey(document.ultrasoundLogId)
      : document.visualInspectionLogId
        ? visualInspectionLogOwnerKey(document.visualInspectionLogId)
        : document.tightnessTestLogId
          ? tightnessTestLogOwnerKey(document.tightnessTestLogId)
          : document.internalVisualInspectionLogId
            ? internalVisualInspectionLogOwnerKey(document.internalVisualInspectionLogId)
            : document.hydrostaticTestLogId
              ? hydrostaticTestLogOwnerKey(document.hydrostaticTestLogId)
              : document.extinguisherChangeLogId
                ? extinguisherChangeLogOwnerKey(document.extinguisherChangeLogId)
                : document.valveChangeLogId
                  ? valveChangeLogOwnerKey(document.valveChangeLogId)
                  : document.valveCorrectiveMaintenanceLogId
                    ? valveCorrectiveMaintenanceLogOwnerKey(document.valveCorrectiveMaintenanceLogId)
                    : document.hoseChangeLogId
                      ? hoseChangeLogOwnerKey(document.hoseChangeLogId)
                      : document.equipmentLogId
                        ? equipmentLogOwnerKey(document.equipmentLogId)
                        : document.equipoId
                          ? equipoOwnerKey(document.equipoId)
                          : document.vehicleRecordId
                            ? vehicleOwnerKey(document.vehicleRecordId)
                            : document.sectionId;
  await deleteDocumentFile(ownerKey, document.storedName);
  await prisma.document.delete({ where: { id: documentId } });

  if (document.maintenanceLog) {
    const vehicle = document.maintenanceLog.vehicleRecord;
    revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicle.id}`);
  } else if (document.ultrasoundLog) {
    const vehicle = document.ultrasoundLog.vehicleRecord;
    revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicle.id}`);
  } else if (document.visualInspectionLog) {
    const vehicle = document.visualInspectionLog.vehicleRecord;
    revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicle.id}`);
  } else if (document.tightnessTestLog) {
    const vehicle = document.tightnessTestLog.vehicleRecord;
    revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicle.id}`);
  } else if (document.internalVisualInspectionLog) {
    const vehicle = document.internalVisualInspectionLog.vehicleRecord;
    revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicle.id}`);
  } else if (document.hydrostaticTestLog) {
    const vehicle = document.hydrostaticTestLog.vehicleRecord;
    revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicle.id}`);
  } else if (document.extinguisherChangeLog) {
    const vehicle = document.extinguisherChangeLog.vehicleRecord;
    revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicle.id}`);
  } else if (document.valveChangeLog) {
    const vehicle = document.valveChangeLog.vehicleRecord;
    revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicle.id}`);
  } else if (document.valveCorrectiveMaintenanceLog) {
    const vehicle = document.valveCorrectiveMaintenanceLog.vehicleRecord;
    revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicle.id}`);
  } else if (document.hoseChangeLog) {
    const vehicle = document.hoseChangeLog.vehicleRecord;
    revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicle.id}`);
  } else if (document.equipmentLog) {
    const equipo = document.equipmentLog.equipo;
    revalidatePath(`/ciudades/${equipo.section.city.slug}/equipo/${equipo.id}`);
  } else if (document.equipo) {
    revalidatePath(`/ciudades/${document.equipo.section.city.slug}/equipo/${document.equipo.id}`);
  } else if (document.vehicleRecordId) {
    revalidatePath(`/ciudades/${document.section.city.slug}/vehiculo/${document.vehicleRecordId}`);
  } else {
    const chain = await getSectionChain(document.sectionId);
    revalidatePath(sectionBasePath(document.section.city.slug, chain));
  }
  return { success: "Documento eliminado." };
}
