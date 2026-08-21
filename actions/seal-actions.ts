"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import type { ActionState } from "./user-actions";

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const createSchema = z.object({
  numeroSello: z.preprocess((value) => String(value ?? "").trim(), z.string().min(1, "El número de sello es requerido").max(100)),
  fechaInstalacion: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? new Date(text) : undefined;
  }, z.date({ required_error: "La fecha de instalación es requerida", invalid_type_error: "Fecha inválida" })),
});

// Sellos de seguridad de una Estación: se cambian día con día, así que es
// un registro deliberadamente simple (solo número y fecha) — ver
// SealLog en el schema.
export async function createSealLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createSchema.safeParse({
    numeroSello: formData.get("numeroSello"),
    fechaInstalacion: formData.get("fechaInstalacion"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  // El rol dice si puede editar, no si puede editar ESTO (ver lib/access.ts).
  await assertCityAccessById(editor, vehicle.section.cityId);

  await prisma.sealLog.create({
    data: { vehicleRecordId: vehicleId, createdById: editor.userId, ...parsed.data },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  return { success: "Sello registrado." };
}

// Dar de baja NO borra el sello (ver CLAUDE.md: ninguna función borra
// bitácoras de mantenimiento): lo marca inactivo y conserva cuándo y por
// qué se cortó o se cambió. El motivo es opcional, igual que al dar de
// baja una unidad.
export async function deactivateSealLog(
  sealLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const motivo = optionalText(500).parse(formData.get("motivo"));

  const log = await prisma.sealLog.findUnique({
    where: { id: sealLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El sello ya no existe." };
  }
  await assertCityAccessById(editor, log.vehicleRecord.section.cityId);

  if (!log.activo) {
    return { error: "Ese sello ya estaba dado de baja." };
  }

  // Cualquier USUARIO editor puede dar de baja un sello (se cambian día con
  // día), pero debe quedar registrado qué perfil lo hizo — ver el listado
  // en Administración / Resumen.
  await prisma.sealLog.update({
    where: { id: sealLogId },
    data: { activo: false, fechaBaja: new Date(), motivoBaja: motivo, deactivatedById: editor.userId },
  });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  return { success: "Sello dado de baja." };
}

// Solo para corregir un error de captura (p. ej. número mal escrito) — a
// diferencia de dar de baja, esto sí quita el registro, por eso pide
// contraseña de ADMIN, igual que el resto de las bitácoras.
export async function deleteSealLog(
  sealLogId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const log = await prisma.sealLog.findUnique({
    where: { id: sealLogId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El sello ya no existe." };
  }
  await assertCityAccessById(admin, log.vehicleRecord.section.cityId);

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Sello de estación",
    resumen: `${log.vehicleRecord.numeroEconomico} — Sello ${log.numeroSello}`,
    citySlug: log.vehicleRecord.section.city.slug,
  });

  await prisma.sealLog.delete({ where: { id: sealLogId } });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  return { success: "Sello eliminado." };
}
