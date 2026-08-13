"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { saveDocumentFile, valveChangeLogOwnerKey, readOptionalPdfFiles } from "@/lib/documents";
import { vincularPiezaARegistro } from "./inventory-actions";
import { deleteLogDocumentFiles } from "@/lib/document-cleanup";
import type { ActionState } from "./user-actions";

const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const requiredDate = (message: string) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? new Date(text) : undefined;
  }, z.date({ required_error: message, invalid_type_error: "Fecha inválida" }));

const optionalDate = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? new Date(text) : null;
}, z.date().nullable());

// Vehículo con tanque de carburación solo tiene 4 de estas 9 válvulas (las
// otras 4 son propias del tanque de carga de Auto-Tanques, ver
// prisma/schema.prisma): esas 4 quedan opcionales aquí y se exigen a mano
// más abajo (requireValvulasCompletas) solo cuando la unidad no es de
// carburación — depende de a qué vehículo pertenece el registro, algo que
// zod no puede saber por sí solo al momento de parsear.
const createValveChangeLogSchema = z
  .object({
    responsable: optionalText(150),
    fechaInstalacion: requiredDate("La fecha de instalación es requerida"),
    fechaFabricacionValvulaLlenado: requiredDate(
      "La fecha de fabricación de la válvula de llenado es requerida"
    ),
    fechaFabricacionValvulaNoRetroceso: optionalDate,
    fechaFabricacionValvulaBypass: optionalDate,
    fechaFabricacionValvulaRetornoVapores: optionalDate,
    fechaFabricacionValvulaServicio: requiredDate(
      "La fecha de fabricación de la válvula de servicio es requerida"
    ),
    fechaFabricacionValvulaMaximoLlenado: requiredDate(
      "La fecha de fabricación de la válvula de máximo llenado es requerida"
    ),
    // Única opcional del juego completo (ver lib/valve-alerts.ts): no todos
    // los tanques de carga tienen esta válvula. Solo se pide la fecha si se
    // marca que sí. No aplica a Vehículo con tanque de carburación.
    tieneValvulaMaximoLlenado85: z.preprocess(
      (value) => value === "on" || value === "true",
      z.boolean()
    ),
    fechaFabricacionValvulaMaximoLlenado85: optionalDate,
    fechaFabricacionValvulaAlivio: requiredDate(
      "La fecha de fabricación de la válvula de seguridad es requerida"
    ),
    fechaFabricacionValvulaDescargaEmergencia: optionalDate,
  })
  .superRefine((data, ctx) => {
    if (data.tieneValvulaMaximoLlenado85 && !data.fechaFabricacionValvulaMaximoLlenado85) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de fabricación de la válvula de máximo llenado 85% es requerida",
        path: ["fechaFabricacionValvulaMaximoLlenado85"],
      });
    }
  })
  .transform((data) => ({
    ...data,
    fechaFabricacionValvulaMaximoLlenado85: data.tieneValvulaMaximoLlenado85
      ? data.fechaFabricacionValvulaMaximoLlenado85
      : null,
  }));

// Las 4 válvulas propias del tanque de carga (no aplican a Vehículo con
// tanque de carburación, ver CreateValveChangeLogForm.tsx/ValveChangeLogRow.tsx)
// solo son obligatorias fuera de esa sección.
function requireValvulasCompletas(
  data: z.infer<typeof createValveChangeLogSchema>
): string | null {
  if (!data.fechaFabricacionValvulaNoRetroceso) {
    return "La fecha de fabricación de la válvula de no retroceso (check) es requerida.";
  }
  if (!data.fechaFabricacionValvulaBypass) {
    return "La fecha de fabricación de la válvula de retroceso (bypass) es requerida.";
  }
  if (!data.fechaFabricacionValvulaRetornoVapores) {
    return "La fecha de fabricación de la válvula de retorno de vapores es requerida.";
  }
  if (!data.fechaFabricacionValvulaDescargaEmergencia) {
    return "La fecha de fabricación de la válvula de descarga de emergencia es requerida.";
  }
  return null;
}

export async function createValveChangeLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createValveChangeLogSchema.safeParse({
    responsable: formData.get("responsable"),
    fechaInstalacion: formData.get("fechaInstalacion"),
    fechaFabricacionValvulaLlenado: formData.get("fechaFabricacionValvulaLlenado"),
    fechaFabricacionValvulaNoRetroceso: formData.get("fechaFabricacionValvulaNoRetroceso"),
    fechaFabricacionValvulaBypass: formData.get("fechaFabricacionValvulaBypass"),
    fechaFabricacionValvulaRetornoVapores: formData.get("fechaFabricacionValvulaRetornoVapores"),
    fechaFabricacionValvulaServicio: formData.get("fechaFabricacionValvulaServicio"),
    fechaFabricacionValvulaMaximoLlenado: formData.get("fechaFabricacionValvulaMaximoLlenado"),
    tieneValvulaMaximoLlenado85: formData.get("tieneValvulaMaximoLlenado85"),
    fechaFabricacionValvulaMaximoLlenado85: formData.get("fechaFabricacionValvulaMaximoLlenado85"),
    fechaFabricacionValvulaAlivio: formData.get("fechaFabricacionValvulaAlivio"),
    fechaFabricacionValvulaDescargaEmergencia: formData.get(
      "fechaFabricacionValvulaDescargaEmergencia"
    ),
  });
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

  if (vehicle.section.slug !== "vehiculo-con-tanque-de-carburacion") {
    const error = requireValvulasCompletas(parsed.data);
    if (error) return { error };
  }

  const log = await prisma.valveChangeLog.create({
    data: {
      vehicleRecordId: vehicleId,
      createdById: editor.userId,
      ...parsed.data,
    },
  });

  // Viene del flujo de Inventarios: la pieza ya quedó marcada "Utilizada" en
  // esta unidad y solo faltaba el registro al que amarrarla.
  const piezaId = String(formData.get("vincularPieza") ?? "").trim();
  if (piezaId) {
    await vincularPiezaARegistro(piezaId, "VALVULAS", log.id, vehicleId);
  }

  for (const file of files) {
    const { storedName } = await saveDocumentFile(valveChangeLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        valveChangeLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  // Al aceptar el cambio, la ficha técnica refleja automáticamente todas las
  // fechas de fabricación y la fecha general de instalación del nuevo juego
  // de válvulas (mismo patrón que extintor: siempre se sobrescribe con lo
  // más reciente).
  const valveSheetFields = {
    fechaInstalacionValvulas: parsed.data.fechaInstalacion,
    fechaFabricacionValvulaLlenado: parsed.data.fechaFabricacionValvulaLlenado,
    fechaFabricacionValvulaNoRetroceso: parsed.data.fechaFabricacionValvulaNoRetroceso,
    fechaFabricacionValvulaBypass: parsed.data.fechaFabricacionValvulaBypass,
    fechaFabricacionValvulaRetornoVapores: parsed.data.fechaFabricacionValvulaRetornoVapores,
    fechaFabricacionValvulaServicio: parsed.data.fechaFabricacionValvulaServicio,
    fechaFabricacionValvulaMaximoLlenado: parsed.data.fechaFabricacionValvulaMaximoLlenado,
    tieneValvulaMaximoLlenado85: parsed.data.tieneValvulaMaximoLlenado85,
    fechaFabricacionValvulaMaximoLlenado85: parsed.data.fechaFabricacionValvulaMaximoLlenado85,
    fechaFabricacionValvulaAlivio: parsed.data.fechaFabricacionValvulaAlivio,
    fechaFabricacionValvulaDescargaEmergencia: parsed.data.fechaFabricacionValvulaDescargaEmergencia,
  };
  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: valveSheetFields,
    create: { vehicleRecordId: vehicleId, ...valveSheetFields },
  });

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);
  revalidatePath("/dashboard");
  return { success: "Cambio de válvulas registrado y ficha técnica actualizada." };
}

// Solo ADMIN puede corregir un registro ya guardado. No vuelve a sincronizar
// la ficha técnica (ver actions/ultrasound-actions.ts para el mismo patrón).
export async function updateValveChangeLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireElevatedEditor();

  const parsed = createValveChangeLogSchema.safeParse({
    responsable: formData.get("responsable"),
    fechaInstalacion: formData.get("fechaInstalacion"),
    fechaFabricacionValvulaLlenado: formData.get("fechaFabricacionValvulaLlenado"),
    fechaFabricacionValvulaNoRetroceso: formData.get("fechaFabricacionValvulaNoRetroceso"),
    fechaFabricacionValvulaBypass: formData.get("fechaFabricacionValvulaBypass"),
    fechaFabricacionValvulaRetornoVapores: formData.get("fechaFabricacionValvulaRetornoVapores"),
    fechaFabricacionValvulaServicio: formData.get("fechaFabricacionValvulaServicio"),
    fechaFabricacionValvulaMaximoLlenado: formData.get("fechaFabricacionValvulaMaximoLlenado"),
    tieneValvulaMaximoLlenado85: formData.get("tieneValvulaMaximoLlenado85"),
    fechaFabricacionValvulaMaximoLlenado85: formData.get("fechaFabricacionValvulaMaximoLlenado85"),
    fechaFabricacionValvulaAlivio: formData.get("fechaFabricacionValvulaAlivio"),
    fechaFabricacionValvulaDescargaEmergencia: formData.get(
      "fechaFabricacionValvulaDescargaEmergencia"
    ),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.valveChangeLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro no existe." };
  }

  if (log.vehicleRecord.section.slug !== "vehiculo-con-tanque-de-carburacion") {
    const error = requireValvulasCompletas(parsed.data);
    if (error) return { error };
  }

  await prisma.valveChangeLog.update({ where: { id: logId }, data: parsed.data });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  revalidatePath("/dashboard");
  return { success: "Registro actualizado." };
}

export async function deleteValveChangeLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireElevatedEditor();

  const passwordError = await verifySessionPassword(admin, formData.get("password"));
  if (passwordError) {
    return { error: passwordError };
  }

  const log = await prisma.valveChangeLog.findUnique({
    where: { id: logId },
    include: { vehicleRecord: { include: { section: { include: { city: true } } } } },
  });
  if (!log) {
    return { error: "El registro ya no existe." };
  }

  await logActivity({
    user: admin,
    accion: "ELIMINAR",
    entidad: "Cambio de válvulas",
    resumen: log.vehicleRecord.numeroEconomico,
    citySlug: log.vehicleRecord.section.city.slug,
  });

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("valveChangeLogId", logId);
  await prisma.valveChangeLog.delete({ where: { id: logId } });

  revalidatePath(`/ciudades/${log.vehicleRecord.section.city.slug}/vehiculo/${log.vehicleRecordId}`);
  revalidatePath("/dashboard");
  return { success: "Registro eliminado." };
}
