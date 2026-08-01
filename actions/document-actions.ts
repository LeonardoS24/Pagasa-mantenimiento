"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireEditor, checkSessionUserExists } from "@/lib/auth";
import {
  saveDocumentFile,
  deleteDocumentFile,
  vehicleOwnerKey,
  maintenanceLogOwnerKey,
  ultrasoundLogOwnerKey,
  visualInspectionLogOwnerKey,
  MAX_DOCUMENT_SIZE,
} from "@/lib/documents";
import { getSectionChain, sectionBasePath } from "@/lib/section-path";
import type { ActionState } from "./user-actions";

function readPdfFromForm(formData: FormData): File | { error: string } {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Selecciona un archivo PDF." };
  }
  if (file.type !== "application/pdf") {
    return { error: "Solo se permiten archivos PDF." };
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

  const file = readPdfFromForm(formData);
  if (!(file instanceof File)) return file;

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { city: true },
  });
  if (!section) {
    return { error: "El apartado no existe." };
  }

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

export async function deleteDocument(documentId: string) {
  await requireAdmin();

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
    },
  });
  if (!document) return;

  const ownerKey = document.maintenanceLogId
    ? maintenanceLogOwnerKey(document.maintenanceLogId)
    : document.ultrasoundLogId
      ? ultrasoundLogOwnerKey(document.ultrasoundLogId)
      : document.visualInspectionLogId
        ? visualInspectionLogOwnerKey(document.visualInspectionLogId)
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
  } else if (document.vehicleRecordId) {
    revalidatePath(`/ciudades/${document.section.city.slug}/vehiculo/${document.vehicleRecordId}`);
  } else {
    const chain = await getSectionChain(document.sectionId);
    revalidatePath(sectionBasePath(document.section.city.slug, chain));
  }
}
