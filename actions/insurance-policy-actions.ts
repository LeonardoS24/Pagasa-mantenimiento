"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { saveDocumentFile, insurancePolicyLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
import { deleteLogDocumentFiles } from "@/lib/document-cleanup";
import type { ActionState } from "./user-actions";

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const requiredDate = (label: string) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? new Date(text) : undefined;
  }, z.date({ required_error: `${label} es requerida`, invalid_type_error: "Fecha inválida" }));

const policySchema = z
  .object({
    fechaRealizacion: requiredDate("La fecha en que se realizó"),
    fechaVencimiento: requiredDate("La fecha de vencimiento"),
    aseguradora: optionalText(150),
    numeroPoliza: optionalText(100),
    observaciones: optionalText(1000),
  })
  .superRefine((data, ctx) => {
    // Una póliza no puede vencer antes de haberse expedido: sin esta regla un
    // error de dedo en las fechas dejaría la alerta en rojo para siempre.
    if (data.fechaVencimiento.getTime() <= data.fechaRealizacion.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de vencimiento debe ser posterior a la fecha en que se realizó la póliza.",
        path: ["fechaVencimiento"],
      });
    }
  });

function leerFormulario(formData: FormData) {
  return policySchema.safeParse({
    fechaRealizacion: formData.get("fechaRealizacion"),
    fechaVencimiento: formData.get("fechaVencimiento"),
    aseguradora: formData.get("aseguradora"),
    numeroPoliza: formData.get("numeroPoliza"),
    observaciones: formData.get("observaciones"),
  });
}

export async function createInsurancePolicyLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = leerFormulario(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const files = readOptionalPdfFiles(formData);
  if (!Array.isArray(files)) return files;

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  // El rol dice si puede editar, no si puede editar ESTO (ver lib/access.ts).
  await assertCityAccessById(editor, vehicle.section.cityId);

  const log = await prisma.insurancePolicyLog.create({
    data: { vehicleRecordId: vehicleId, createdById: editor.userId, ...parsed.data },
  });

  for (const file of files) {
    const { storedName } = await saveDocumentFile(insurancePolicyLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        insurancePolicyLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  revalidatePath("/dashboard");
  return { success: "Póliza de seguro registrada." };
}

// Solo ADMIN (o USUARIO con acceso ampliado) puede corregir una póliza ya
// guardada, igual que el resto de las bitácoras.
export async function updateInsurancePolicyLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireElevatedEditor();

  const parsed = leerFormulario(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.insurancePolicyLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }
  await assertCityAccessById(editor, log.vehicleRecord.section.cityId);

  await prisma.insurancePolicyLog.update({ where: { id: logId }, data: parsed.data });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  revalidatePath("/dashboard");
  return { success: "Póliza actualizada." };
}

export async function deleteInsurancePolicyLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const log = await prisma.insurancePolicyLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro ya no existe." };
  }
  await assertCityAccessById(admin, log.vehicleRecord.section.cityId);

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Póliza de seguro",
    resumen: log.vehicleRecord.numeroEconomico,
    citySlug: log.vehicleRecord.section.city.slug,
  });

  // El archivo en disco se borra aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("insurancePolicyLogId", logId);
  await prisma.insurancePolicyLog.delete({ where: { id: logId } });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  revalidatePath("/dashboard");
  return { success: "Póliza eliminada." };
}
