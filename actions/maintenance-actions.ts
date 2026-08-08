"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireElevatedEditor, requireEditor, checkSessionUserExists } from "@/lib/auth";
import { getSectionChain, sectionBasePath } from "@/lib/section-path";
import { maintenanceStatusSchema, maintenanceTypeSchema, calidadMantenimientoSchema } from "@/lib/vehicle-enums";
import { accionPiezaSchema } from "@/lib/piece-catalog";
import {
  parseChecklistPreventivo,
  isChecklistDocumentable,
  CHECKLIST_PIECE_CATEGORY,
} from "@/lib/preventive-checklist";
import {
  saveDocumentFile,
  maintenanceLogOwnerKey,
  readOptionalPdfFiles,
  readOptionalImageFile,
} from "@/lib/documents";
import { vincularPiezaARegistro, usarPiezaDesdeMantenimiento } from "./inventory-actions";
import { deleteLogDocumentFiles } from "@/lib/document-cleanup";
import type { ActionState } from "./user-actions";

const requiredText = (label: string, max: number) =>
  z.preprocess((value) => String(value ?? "").trim(), z.string().min(1, `${label} es requerido`).max(max));

// null (no undefined) para que un campo vaciado en el formulario también se
// borre al actualizar: Prisma ignora las claves undefined en un update.
const optionalText = (max: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, z.string().max(max).nullable());

const requiredInt = (label: string) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? Number(text) : undefined;
  }, z.number({ required_error: `${label} es requerido`, invalid_type_error: `${label} inválido` }).int().min(0));

const createLogSchema = z.object({
  tipoMantenimiento: maintenanceTypeSchema,
  tipoServicio: requiredText("El tipo de servicio", 100),
  calidad: calidadMantenimientoSchema,
  categoriaPieza: optionalText(100),
  pieza: optionalText(100),
  accionPieza: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, accionPiezaSchema.nullable()),
  checklistPreventivo: optionalText(20000),
  cantidad: optionalText(50),
  unidad: optionalText(50),
  descripcion: optionalText(1000),
  observacion: optionalText(1000),
  fecha: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? new Date(text) : undefined;
  }, z.date({ required_error: "La fecha es requerida", invalid_type_error: "Fecha inválida" })),
  kilometraje: requiredInt("El kilometraje"),
  nombreOperador: optionalText(150),
  auxiliarTecnico: optionalText(150),
  responsableTrabajoMecanico: optionalText(150),
  estatus: maintenanceStatusSchema.default("SIN_ATENCION"),
});

// Suma 6 meses a una fecha (UTC, sin desfase de zona horaria) — mismo patrón
// que addTenYears en actions/vehicle-actions.ts.
function addSixMonths(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 6, date.getUTCDate()));
}

// El mantenimiento con la fecha más cercana a hoy, sin importar si tiene
// kilometraje capturado (sirve para las fechas: un registro viejo sin
// kilometraje — de antes de que este campo fuera obligatorio — igual debe
// poder marcar "el último preventivo").
function masCercanoAHoyPorFecha<T extends { fecha: Date }>(logs: T[]): T | null {
  if (logs.length === 0) return null;
  const hoy = Date.now();
  return logs.reduce((mejor, actual) =>
    Math.abs(hoy - actual.fecha.getTime()) < Math.abs(hoy - mejor.fecha.getTime()) ? actual : mejor
  );
}

// Igual que arriba, pero solo entre los que sí tienen kilometraje (para los
// campos que son un número, no hay de dónde sacarlo si no se capturó). No es
// "el último que se guardó/editó": un registro atrasado con fecha vieja no
// debe pisar con un kilometraje viejo lo que ya se sabía por uno más
// reciente. Empate de fecha se resuelve con el kilometraje más alto (el
// odómetro no retrocede).
function masCercanoAHoyConKilometraje<T extends { fecha: Date; kilometraje: number | null }>(
  logs: T[]
): (T & { kilometraje: number }) | null {
  const conKilometraje = logs.filter((log): log is T & { kilometraje: number } => log.kilometraje !== null);
  if (conKilometraje.length === 0) return null;

  const hoy = Date.now();
  return conKilometraje.reduce((mejor, actual) => {
    const distanciaMejor = Math.abs(hoy - mejor.fecha.getTime());
    const distanciaActual = Math.abs(hoy - actual.fecha.getTime());
    if (distanciaActual < distanciaMejor) return actual;
    if (distanciaActual === distanciaMejor && actual.kilometraje > mejor.kilometraje) return actual;
    return mejor;
  });
}

// Recalcula el kilometraje actual y las fechas de mantenimiento preventivo de
// la ficha técnica a partir de TODOS los mantenimientos de la unidad (no solo
// el que se acaba de crear/editar/borrar), así que hay que llamarla después
// de cualquier cambio a la bitácora de mantenimiento. "Kilometraje actual" se
// toma de cualquier tipo de mantenimiento; "último/próximo preventivo" solo
// de los de tipo "Preventivo".
async function recalcularFichaTecnicaMantenimiento(vehicleId: string): Promise<void> {
  const logs = await prisma.maintenanceLog.findMany({
    where: { vehicleRecordId: vehicleId },
    select: { fecha: true, kilometraje: true, tipoMantenimiento: true, calidad: true },
  });
  const logsPreventivo = logs.filter((log) => log.tipoMantenimiento === "Preventivo");

  const masRecienteGeneral = masCercanoAHoyConKilometraje(logs);
  const masRecientePreventivoPorFecha = masCercanoAHoyPorFecha(logsPreventivo);
  const masRecientePreventivoConKm = masCercanoAHoyConKilometraje(logsPreventivo);
  // La calidad general de la unidad se toma del mantenimiento (de cualquier
  // tipo) con la fecha más cercana a hoy, igual criterio que el kilometraje
  // actual — no solo de los Preventivo.
  const logsConCalidad = logs.filter((log): log is typeof log & { calidad: string } => log.calidad !== null);
  const masRecienteConCalidad = masCercanoAHoyPorFecha(logsConCalidad);

  const sheetFields = {
    kilometrajeUltimoMantenimiento: masRecienteGeneral?.kilometraje ?? null,
    fechaUltimoMantenimiento: masRecientePreventivoPorFecha?.fecha ?? null,
    fechaProximoMantenimiento: masRecientePreventivoPorFecha
      ? addSixMonths(masRecientePreventivoPorFecha.fecha)
      : null,
    kilometrajeProximoMantenimiento:
      masRecientePreventivoConKm != null ? masRecientePreventivoConKm.kilometraje + 10000 : null,
  };

  await prisma.vehicleTechnicalSheet.upsert({
    where: { vehicleRecordId: vehicleId },
    update: sheetFields,
    create: { vehicleRecordId: vehicleId, ...sheetFields },
  });

  await prisma.vehicleRecord.update({
    where: { id: vehicleId },
    data: { calidad: masRecienteConCalidad?.calidad ?? null },
  });
}

async function revalidateVehicleAndCityFeed(vehicleId: string) {
  const vehicle = await prisma.vehicleRecord.findUnique({
    where: { id: vehicleId },
    include: { section: { include: { city: true } } },
  });
  if (!vehicle) return;

  revalidatePath(`/ciudades/${vehicle.section.city.slug}/vehiculo/${vehicleId}`);

  const chain = await getSectionChain(vehicle.sectionId);
  const rootSlug = chain[0]?.slug;
  if (rootSlug === "bitacoras-de-unidades") {
    revalidatePath(sectionBasePath(vehicle.section.city.slug, [chain[0]]));
  } else {
    const bitacoraRoot = await prisma.section.findFirst({
      where: { cityId: vehicle.section.cityId, parentId: null, slug: "bitacoras-de-unidades" },
    });
    if (bitacoraRoot) {
      revalidatePath(sectionBasePath(vehicle.section.city.slug, [bitacoraRoot]));
    }
  }
}

export async function createMaintenanceLog(
  vehicleId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const parsed = createLogSchema.safeParse({
    tipoMantenimiento: formData.get("tipoMantenimiento"),
    tipoServicio: formData.get("tipoServicio"),
    calidad: formData.get("calidad"),
    categoriaPieza: formData.get("categoriaPieza"),
    pieza: formData.get("pieza"),
    accionPieza: formData.get("accionPieza"),
    checklistPreventivo: formData.get("checklistPreventivo"),
    cantidad: formData.get("cantidad"),
    unidad: formData.get("unidad"),
    descripcion: formData.get("descripcion"),
    observacion: formData.get("observacion"),
    fecha: formData.get("fecha"),
    kilometraje: formData.get("kilometraje"),
    nombreOperador: formData.get("nombreOperador"),
    auxiliarTecnico: formData.get("auxiliarTecnico"),
    responsableTrabajoMecanico: formData.get("responsableTrabajoMecanico"),
    estatus: formData.get("estatus"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const files = readOptionalPdfFiles(formData);
  if (!Array.isArray(files)) return files;

  // Foto de cómo estaba la unidad antes del mantenimiento y cómo quedó
  // después. Cada una es un solo archivo, a diferencia de los PDF que
  // aceptan varios.
  const fotoAntes = readOptionalImageFile(formData, "fotoAntes");
  if (fotoAntes && !(fotoAntes instanceof File)) return fotoAntes;
  const fotoDespues = readOptionalImageFile(formData, "fotoDespues");
  if (fotoDespues && !(fotoDespues instanceof File)) return fotoDespues;

  const vehicle = await prisma.vehicleRecord.findUnique({ where: { id: vehicleId } });
  if (!vehicle) {
    return { error: "El registro no existe." };
  }

  // El checklist de mantenimiento preventivo solo aplica (y solo se confía
  // en él) cuando ese es el tipo elegido; para Correctivo/Predictivo la
  // pieza viene del selector de categoría/pieza/acción de siempre.
  const checklist =
    parsed.data.tipoMantenimiento === "Preventivo"
      ? parseChecklistPreventivo(parsed.data.checklistPreventivo)
      : null;

  const log = await prisma.maintenanceLog.create({
    data: {
      vehicleRecordId: vehicleId,
      createdById: editor.userId,
      ...parsed.data,
      checklistPreventivo: checklist ? parsed.data.checklistPreventivo : null,
    },
  });

  // Del checklist, todo lo que no quedó en "Buen estado" (Relleno,
  // Lubricación o Cambio) se documenta como su propio registro de pieza; solo
  // "Buen estado" no genera nada aparte del checklist guardado arriba. Cada
  // uno alimenta el gráfico de piezas igual que un mantenimiento correctivo
  // con pieza seleccionada.
  const piezasDocumentables = checklist?.filter((entry) => isChecklistDocumentable(entry.estado)) ?? [];
  for (const entry of piezasDocumentables) {
    await prisma.maintenanceLog.create({
      data: {
        vehicleRecordId: vehicleId,
        createdById: editor.userId,
        tipoMantenimiento: "Preventivo",
        tipoServicio: `${entry.estado} de ${entry.item}`,
        categoriaPieza: CHECKLIST_PIECE_CATEGORY,
        pieza: entry.item,
        accionPieza: "Mantenimiento preventivo",
        cantidad: entry.cantidad ?? null,
        descripcion: entry.descripcion?.trim()
          ? entry.descripcion.trim()
          : "Generado del checklist de mantenimiento preventivo.",
        fecha: parsed.data.fecha,
        estatus: parsed.data.estatus,
      },
    });
  }

  // Viene del flujo de Inventarios: la pieza ya quedó marcada "Utilizada" en
  // esta unidad y solo faltaba el registro al que amarrarla.
  const piezaId = String(formData.get("vincularPieza") ?? "").trim();
  if (piezaId) {
    await vincularPiezaARegistro(piezaId, "MANTENIMIENTO", log.id, vehicleId);
  }

  // Dirección inversa: la pieza se eligió aquí mismo del inventario todavía
  // disponible (ver components/admin/CreateMaintenanceLogForm.tsx), así que
  // hay que marcarla "Utilizada" y ligarla a este registro recién creado.
  const piezaInventarioId = String(formData.get("piezaInventarioId") ?? "").trim();
  if (piezaInventarioId) {
    await usarPiezaDesdeMantenimiento(piezaInventarioId, vehicleId, log.id);
  }

  for (const file of files) {
    const { storedName } = await saveDocumentFile(maintenanceLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        maintenanceLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
      },
    });
  }

  for (const [kind, file] of [
    ["ANTES", fotoAntes],
    ["DESPUES", fotoDespues],
  ] as const) {
    if (!file) continue;
    const { storedName } = await saveDocumentFile(maintenanceLogOwnerKey(log.id), file);
    await prisma.document.create({
      data: {
        sectionId: vehicle.sectionId,
        maintenanceLogId: log.id,
        fileName: file.name,
        storedName,
        mimeType: file.type,
        size: file.size,
        uploadedById: editor.userId,
        kind,
      },
    });
  }

  await recalcularFichaTecnicaMantenimiento(vehicleId);

  await revalidateVehicleAndCityFeed(vehicleId);
  return { success: "Mantenimiento registrado." };
}

// Edición simple para USUARIO (ver EditStatusForm): solo el estatus. La
// descripción es de solo lectura para este rol — cambiarla requiere ADMIN vía
// updateMaintenanceLogFull. No basta con ocultar el campo en el formulario:
// este schema tampoco la acepta, aunque llegara en el FormData.
const updateLogSchema = z.object({
  estatus: maintenanceStatusSchema,
});

export async function updateMaintenanceLog(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireEditor();

  const parsed = updateLogSchema.safeParse({
    estatus: formData.get("estatus"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.maintenanceLog.findUnique({ where: { id: logId } });
  if (!log) {
    return { error: "El registro no existe." };
  }

  await prisma.maintenanceLog.update({ where: { id: logId }, data: parsed.data });

  await revalidateVehicleAndCityFeed(log.vehicleRecordId);
  return { success: "Actualizado." };
}

const updateLogFullSchema = z.object({
  tipoMantenimiento: maintenanceTypeSchema,
  tipoServicio: requiredText("El tipo de servicio", 100),
  calidad: calidadMantenimientoSchema,
  categoriaPieza: optionalText(100),
  pieza: optionalText(100),
  accionPieza: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? text : null;
  }, accionPiezaSchema.nullable()),
  cantidad: optionalText(50),
  unidad: optionalText(50),
  descripcion: optionalText(1000),
  observacion: optionalText(1000),
  fecha: z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text.length > 0 ? new Date(text) : undefined;
  }, z.date({ required_error: "La fecha es requerida", invalid_type_error: "Fecha inválida" })),
  kilometraje: requiredInt("El kilometraje"),
  nombreOperador: optionalText(150),
  auxiliarTecnico: optionalText(150),
  responsableTrabajoMecanico: optionalText(150),
  estatus: maintenanceStatusSchema,
});

// Edición completa, solo ADMIN: a diferencia de updateMaintenanceLog (que
// cualquier editor usa para corregir descripción/estatus), esta cubre todos
// los campos capturables. El checklist de mantenimiento preventivo
// (checklistPreventivo) no se edita aquí — queda tal como se capturó, ya
// que reeditarlo implicaría rehacer también los registros de pieza que
// generó (ver createMaintenanceLog). Si el kilometraje o la fecha cambian,
// eso puede mover cuál mantenimiento es "el más cercano a hoy", así que
// también recalcula la ficha técnica.
export async function updateMaintenanceLogFull(
  logId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireElevatedEditor();

  const parsed = updateLogFullSchema.safeParse({
    tipoMantenimiento: formData.get("tipoMantenimiento"),
    tipoServicio: formData.get("tipoServicio"),
    calidad: formData.get("calidad"),
    categoriaPieza: formData.get("categoriaPieza"),
    pieza: formData.get("pieza"),
    accionPieza: formData.get("accionPieza"),
    cantidad: formData.get("cantidad"),
    unidad: formData.get("unidad"),
    descripcion: formData.get("descripcion"),
    observacion: formData.get("observacion"),
    fecha: formData.get("fecha"),
    kilometraje: formData.get("kilometraje"),
    nombreOperador: formData.get("nombreOperador"),
    auxiliarTecnico: formData.get("auxiliarTecnico"),
    responsableTrabajoMecanico: formData.get("responsableTrabajoMecanico"),
    estatus: formData.get("estatus"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const log = await prisma.maintenanceLog.findUnique({ where: { id: logId } });
  if (!log) {
    return { error: "El registro no existe." };
  }

  await prisma.maintenanceLog.update({ where: { id: logId }, data: parsed.data });
  await recalcularFichaTecnicaMantenimiento(log.vehicleRecordId);

  await revalidateVehicleAndCityFeed(log.vehicleRecordId);
  return { success: "Registro actualizado." };
}

export async function deleteMaintenanceLog(logId: string) {
  await requireElevatedEditor();

  const log = await prisma.maintenanceLog.findUnique({ where: { id: logId } });
  if (!log) return;

  // Los PDF de la bitácora se van con ella en la base, pero el archivo en
  // disco hay que borrarlo aparte y antes, mientras el registro existe.
  await deleteLogDocumentFiles("maintenanceLogId", logId);
  await prisma.maintenanceLog.delete({ where: { id: logId } });
  // Si el que se borró era "el más cercano a hoy", la ficha técnica debe
  // volver a reflejar el que le sigue (o quedar vacía si ya no queda ninguno).
  await recalcularFichaTecnicaMantenimiento(log.vehicleRecordId);
  await revalidateVehicleAndCityFeed(log.vehicleRecordId);
}
