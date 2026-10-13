"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
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
    responsableCambio: optionalText(150),
    responsableSupervision: optionalText(150),
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
      "La fecha de fabricación de la válvula de alivio (seguridad) es requerida"
    ),
    fechaFabricacionValvulaDescargaEmergencia: optionalDate,
    // Solo tanque de carga y opcionales: llegaron después al juego (ver
    // lib/ficha-campos.ts). Si se dejan vacías, la ficha conserva la fecha
    // que ya tenía (ver valveSheetFields más abajo).
    fechaFabricacionValvulaExcesoFlujo: optionalDate,
    fechaFabricacionValvulaCheckLock: optionalDate,
  })
  .superRefine((data, ctx) => {
    if (data.tieneValvulaMaximoLlenado85 && !data.fechaFabricacionValvulaMaximoLlenado85) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "La fecha de fabricación de la válvula de máximo llenado 85% es requerida",
        path: ["fechaFabricacionValvulaMaximoLlenado85"],
      });
    }

    // Una válvula no se puede instalar antes de existir: si la fecha de
    // instalación queda antes que la de fabricación de cualquiera de ellas,
    // es un error de captura. Se detecta aquí para no dejarlo pasar (así
    // quedó capturado en su momento LL100, con instalación 8 meses antes de
    // la fabricación, y eso descuadra el vencimiento).
    for (const [campo, etiqueta] of VALVULA_ETIQUETAS) {
      const fabricacion = data[campo];
      if (!fabricacion) continue;
      if (data.fechaInstalacion.getTime() >= fabricacion.getTime()) continue;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Error en las fechas: la instalación (${formatoCorto(data.fechaInstalacion)}) es anterior a la fabricación de la ${etiqueta} (${formatoCorto(fabricacion)}). Una válvula no puede instalarse antes de fabricarse.`,
        path: ["fechaInstalacion"],
      });
      return;
    }
  })
  .transform((data) => ({
    ...data,
    fechaFabricacionValvulaMaximoLlenado85: data.tieneValvulaMaximoLlenado85
      ? data.fechaFabricacionValvulaMaximoLlenado85
      : null,
  }));

// Nombre visible de cada válvula, para poder decir en el mensaje de error
// cuál de todas es la que tiene la fecha imposible.
const VALVULA_ETIQUETAS = [
  ["fechaFabricacionValvulaLlenado", "válvula de llenado"],
  ["fechaFabricacionValvulaNoRetroceso", "válvula de no retroceso (check)"],
  ["fechaFabricacionValvulaBypass", "válvula de bypass"],
  ["fechaFabricacionValvulaRetornoVapores", "válvula de retorno de vapores"],
  ["fechaFabricacionValvulaServicio", "válvula de servicio de vapor"],
  ["fechaFabricacionValvulaMaximoLlenado", "válvula de máximo llenado 90%"],
  ["fechaFabricacionValvulaMaximoLlenado85", "válvula de máximo llenado 85%"],
  ["fechaFabricacionValvulaAlivio", "válvula de alivio (seguridad)"],
  ["fechaFabricacionValvulaDescargaEmergencia", "válvula de descarga de emergencia"],
  ["fechaFabricacionValvulaExcesoFlujo", "válvula de exceso de flujo (litrómetro)"],
  ["fechaFabricacionValvulaCheckLock", "válvula check lock"],
] as const;

function formatoCorto(fecha: Date): string {
  return fecha.toISOString().slice(0, 10).split("-").reverse().join("/");
}

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
    return "La fecha de fabricación de la válvula de bypass es requerida.";
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
    responsableCambio: formData.get("responsableCambio"),
    responsableSupervision: formData.get("responsableSupervision"),
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
    fechaFabricacionValvulaExcesoFlujo: formData.get("fechaFabricacionValvulaExcesoFlujo"),
    fechaFabricacionValvulaCheckLock: formData.get("fechaFabricacionValvulaCheckLock"),
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

  // El rol dice si puede editar, no si puede editar ESTO: vehicleId llega
  // del navegador y esta acción es un endpoint llamable directo, así que sin
  // esto un USUARIO de una ciudad podía escribir en la bitácora de otra
  // (ver lib/access.ts).
  await assertCityAccessById(editor, vehicle.section.cityId);

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
    // undefined = Prisma no lo toca: si no se capturaron en este cambio, la
    // ficha se queda con la fecha que ya tenía.
    fechaFabricacionValvulaExcesoFlujo: parsed.data.fechaFabricacionValvulaExcesoFlujo ?? undefined,
    fechaFabricacionValvulaCheckLock: parsed.data.fechaFabricacionValvulaCheckLock ?? undefined,
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
  const editor = await requireElevatedEditor();

  const parsed = createValveChangeLogSchema.safeParse({
    responsableCambio: formData.get("responsableCambio"),
    responsableSupervision: formData.get("responsableSupervision"),
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
    fechaFabricacionValvulaExcesoFlujo: formData.get("fechaFabricacionValvulaExcesoFlujo"),
    fechaFabricacionValvulaCheckLock: formData.get("fechaFabricacionValvulaCheckLock"),
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
  // Ver lib/access.ts: el rol dice si puede editar, no si puede editar ESTO.
  await assertCityAccessById(editor, log.vehicleRecord.section.cityId);

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
  // Ver lib/access.ts: el rol dice si puede editar, no si puede editar ESTO.
  await assertCityAccessById(admin, log.vehicleRecord.section.cityId);

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
