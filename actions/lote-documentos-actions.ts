"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { isAggregateCitySlug, getAllRealCityIds } from "@/lib/aggregate-city";
import {
  TIPOS_LOTE,
  CAMPOS_POR_TIPO,
  MAX_LOTE_BYTES,
  leerItemsLote,
  tipoAplicaEnApartado,
  esPruebaDeTanque,
  nombreArchivoItem,
  tipoLoteLabel,
  type ItemLote,
  type CampoItem,
} from "@/lib/lote-documentos";
import { guardarOriginalLote, leerOriginalLote, contarPaginasPdf, extraerPaginasPdf } from "@/lib/lote-documentos-archivos";
import { lectorConfigurado, leerLoteConIA } from "@/lib/lector-documentos-ia";
import { createUltrasoundLog } from "./ultrasound-actions";
import { createVisualInspectionLog } from "./visual-inspection-actions";
import { createTightnessTestLog } from "./tightness-test-actions";
import { createInternalVisualInspectionLog } from "./internal-visual-inspection-actions";
import { createHydrostaticTestLog } from "./hydrostatic-test-actions";
import { createMaintenanceLog } from "./maintenance-actions";
import { createExtinguisherChangeLog } from "./extinguisher-actions";
import { createHoseChangeLog } from "./hose-actions";
import { createInsurancePolicyLog } from "./insurance-policy-actions";
import { uploadVehicleDocument } from "./document-actions";
import type { ActionState } from "./user-actions";

// Carga de documentos escaneados (ver LoteDocumentos en el schema y
// lib/lote-documentos.ts). Cada documento del lote se guarda llamando a la
// MISMA acción que usa el formulario de su bitácora, con solo sus páginas
// como archivo adjunto: así hereda sus validaciones, la revisión de acceso a
// la ciudad, el cálculo de fechas próximas y la actualización de la ficha
// técnica, sin duplicar nada de eso aquí.

function rutaLote(citySlug: string, loteId: string) {
  return `/ciudades/${citySlug}/carga-de-documentos/${loteId}`;
}

// Ciudades cuyas unidades pueden venir en el lote: las de la ciudad, o las
// de todas si el lote se subió desde Administración (lib/aggregate-city.ts).
async function ciudadesDelLote(city: { id: string; slug: string }): Promise<string[]> {
  return isAggregateCitySlug(city.slug) ? getAllRealCityIds() : [city.id];
}

// Un solo cambio a la vez por lote: la lista de documentos vive en un JSON,
// y dos guardados encimados (un doble clic, dos personas) podían pisarse o
// crear el mismo registro dos veces. El servidor es un solo proceso de
// Node, así que basta con encadenarlos en memoria.
const candados = new Map<string, Promise<unknown>>();
async function conCandado<T>(loteId: string, fn: () => Promise<T>): Promise<T> {
  const previo = candados.get(loteId) ?? Promise.resolve();
  const actual = previo.catch(() => undefined).then(fn);
  candados.set(loteId, actual);
  try {
    return await actual;
  } finally {
    if (candados.get(loteId) === actual) candados.delete(loteId);
  }
}

async function guardarItems(loteId: string, items: ItemLote[]) {
  await prisma.loteDocumentos.update({ where: { id: loteId }, data: { documentos: JSON.stringify(items) } });
}

function mensajeDeError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "La clave de la API de Claude (ANTHROPIC_API_KEY) no es válida o no tiene permiso.";
  }
  if (error instanceof Anthropic.RateLimitError) {
    return "La API de Claude está saturada o se alcanzó el límite de la cuenta. Intenta de nuevo en unos minutos.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "El servidor no pudo conectarse a internet (api.anthropic.com). Revisa la conexión y vuelve a intentar.";
  }
  if (error instanceof Anthropic.APIError) {
    return `La API de Claude respondió con un error (${error.status ?? "sin código"}). Intenta de nuevo.`;
  }
  return error instanceof Error ? error.message : "Error desconocido al leer el lote.";
}

// Corre fuera del request (no se espera): la lectura de un lote grande
// tarda minutos, y la página de revisión se actualiza sola mientras tanto
// (ver ActualizarMientrasAnaliza). Si el servidor se reinicia a la mitad,
// el lote se queda en ANALIZANDO y se puede reintentar desde la revisión.
async function analizarLote(loteId: string): Promise<void> {
  try {
    const lote = await prisma.loteDocumentos.findUnique({ where: { id: loteId }, include: { city: true } });
    if (!lote) return;
    const pdf = await leerOriginalLote(lote.id, lote.storedName);
    const resultado = await leerLoteConIA(pdf, lote.paginas, await ciudadesDelLote(lote.city));

    await conCandado(loteId, async () => {
      const actual = await prisma.loteDocumentos.findUnique({ where: { id: loteId } });
      if (!actual) return;
      // Lo que ya se agregó a mano o se resolvió se conserva; lo leído se
      // agrega después, ordenado por página.
      const items = [...leerItemsLote(actual.documentos), ...resultado.items].sort(
        (a, b) => a.paginaInicio - b.paginaInicio
      );
      await prisma.loteDocumentos.update({
        where: { id: loteId },
        data: {
          estado: "POR_REVISAR",
          error: null,
          documentos: JSON.stringify(items),
          notasLector: resultado.notas,
          tokensEntrada: (actual.tokensEntrada ?? 0) + resultado.tokensEntrada,
          tokensSalida: (actual.tokensSalida ?? 0) + resultado.tokensSalida,
          analizadoEl: new Date(),
        },
      });
    });
  } catch (error) {
    console.error(`[lote ${loteId}] Falló la lectura con IA:`, error);
    await prisma.loteDocumentos
      .update({ where: { id: loteId }, data: { estado: "ERROR", error: mensajeDeError(error) } })
      .catch(() => undefined);
  }
}

export async function crearLoteDocumentos(
  citySlug: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const city = await prisma.city.findUnique({ where: { slug: citySlug } });
  if (!city) return { error: "La ciudad no existe." };
  // Ver lib/access.ts: el rol dice si puede editar, no si puede editar ESTO.
  await assertCityAccessById(editor, city.id);

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { error: "Selecciona el PDF escaneado." };
  if (archivo.type !== "application/pdf") return { error: `"${archivo.name}" no es un PDF.` };
  if (archivo.size > MAX_LOTE_BYTES) {
    return { error: `"${archivo.name}" supera 20 MB. Escanéalo en dos partes o con menor resolución.` };
  }

  const datos = Buffer.from(await archivo.arrayBuffer());
  let paginas: number;
  try {
    paginas = await contarPaginasPdf(datos);
  } catch {
    return { error: `No se pudo abrir "${archivo.name}". ¿Está dañado o protegido con contraseña?` };
  }
  if (paginas === 0) return { error: "El PDF no tiene páginas." };

  const conIA = lectorConfigurado();
  const lote = await prisma.loteDocumentos.create({
    data: {
      cityId: city.id,
      fileName: archivo.name,
      storedName: "",
      size: archivo.size,
      paginas,
      // Sin clave de la API el lote se divide a mano desde la revisión.
      estado: conIA ? "ANALIZANDO" : "POR_REVISAR",
      createdById: editor.userId,
    },
  });
  const storedName = await guardarOriginalLote(lote.id, datos);
  await prisma.loteDocumentos.update({ where: { id: lote.id }, data: { storedName } });

  if (conIA) void analizarLote(lote.id);

  redirect(rutaLote(city.slug, lote.id));
}

// Un lote que lleva este tiempo "leyendo" ya no tiene lectura en curso (el
// servidor se reinició a la mitad): se permite volver a lanzarla.
const LECTURA_ATORADA_MS = 10 * 60 * 1000;

export async function reintentarLecturaLote(loteId: string, _prevState: ActionState): Promise<ActionState> {
  const editor = await requireEditor();
  const lote = await prisma.loteDocumentos.findUnique({ where: { id: loteId }, include: { city: true } });
  if (!lote) return { error: "El lote no existe." };
  await assertCityAccessById(editor, lote.cityId);

  if (!lectorConfigurado()) return { error: "La lectura automática no está configurada en el servidor." };
  const atorado = lote.estado === "ANALIZANDO" && Date.now() - lote.updatedAt.getTime() > LECTURA_ATORADA_MS;
  if (lote.estado !== "ERROR" && !atorado) {
    return { error: "Este lote no necesita volver a leerse." };
  }

  await prisma.loteDocumentos.update({ where: { id: loteId }, data: { estado: "ANALIZANDO", error: null } });
  void analizarLote(loteId);
  revalidatePath(rutaLote(lote.city.slug, loteId));
  return { success: "Leyendo de nuevo..." };
}

// Lo que se puede corregir de un documento antes de guardarlo.
const textoONulo = z.preprocess((v) => {
  const t = String(v ?? "").trim();
  return t.length > 0 ? t : null;
}, z.string().max(1000).nullable());

const edicionSchema = z.object({
  tipo: z.enum(TIPOS_LOTE),
  vehicleId: textoONulo,
  tanqueId: textoONulo,
  paginaInicio: z.coerce.number({ invalid_type_error: "Página inicial inválida" }).int().min(1, "Página inicial inválida"),
  paginaFin: z.coerce.number({ invalid_type_error: "Página final inválida" }).int().min(1, "Página final inválida"),
});

const CAMPOS: CampoItem[] = [
  "compania",
  "numero",
  "responsable",
  "fechaRealizacion",
  "fechaAnterior",
  "fechaProxima",
  "fechaVencimiento",
  "fechaFabricacion",
  "calidad",
  "tipoMantenimiento",
  "tipoServicio",
  "kilometraje",
  "estatus",
  "descripcion",
  "observaciones",
];

// El FormData que espera la acción de cada bitácora, con los nombres de
// campo de su propio formulario (components/admin/Create*Form.tsx).
function formularioDeBitacora(item: ItemLote, archivo: File): FormData {
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
  // "Otro documento de la unidad" se sube con uploadVehicleDocument, que
  // espera un solo archivo en "file"; las bitácoras aceptan varios en "files".
  fd.append(item.tipo === "UNIDAD" ? "file" : "files", archivo);
  return fd;
}

function guardarEnBitacora(item: ItemLote, vehicleId: string, tanqueId: string | null, fd: FormData) {
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

export async function guardarDocumentoDeLote(
  loteId: string,
  itemId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  const lote = await prisma.loteDocumentos.findUnique({ where: { id: loteId }, include: { city: true } });
  if (!lote) return { error: "El lote no existe." };
  await assertCityAccessById(editor, lote.cityId);
  if (lote.estado === "ANALIZANDO") return { error: "Espera a que termine la lectura del lote." };

  const edicion = edicionSchema.safeParse({
    tipo: formData.get("tipo"),
    vehicleId: formData.get("vehicleId"),
    tanqueId: formData.get("tanqueId"),
    paginaInicio: formData.get("paginaInicio"),
    paginaFin: formData.get("paginaFin"),
  });
  if (!edicion.success) return { error: edicion.error.issues[0]?.message ?? "Datos inválidos" };
  const campos = Object.fromEntries(CAMPOS.map((c) => [c, textoONulo.parse(formData.get(c))])) as Record<
    CampoItem,
    string | null
  >;

  return conCandado(loteId, async () => {
    const actual = await prisma.loteDocumentos.findUnique({ where: { id: loteId } });
    if (!actual) return { error: "El lote no existe." };
    const items = leerItemsLote(actual.documentos);
    const indice = items.findIndex((i) => i.id === itemId);
    if (indice < 0) return { error: "Ese documento ya no está en el lote." };
    if (items[indice].estado !== "PENDIENTE") return { error: "Ese documento ya se guardó o se descartó." };

    // Las correcciones se guardan desde ya, aunque el registro todavía no
    // pase: si falta un dato, lo capturado no se pierde al recargar.
    const item: ItemLote = { ...items[indice], ...edicion.data, ...campos, mensaje: null };
    items[indice] = item;
    await guardarItems(loteId, items);
    const fallar = async (error: string): Promise<ActionState> => {
      items[indice] = { ...item, mensaje: error };
      await guardarItems(loteId, items);
      revalidatePath(rutaLote(lote.city.slug, loteId));
      return { error };
    };

    if (item.paginaFin < item.paginaInicio) return fallar("La página final no puede ser antes que la inicial.");
    if (item.paginaFin > lote.paginas) return fallar(`El escaneo solo tiene ${lote.paginas} páginas.`);
    if (!item.vehicleId) return fallar("Elige la unidad a la que pertenece el documento.");

    const vehicle = await prisma.vehicleRecord.findUnique({
      where: { id: item.vehicleId },
      include: { section: true, stationTankTechnicalSheets: { select: { id: true } } },
    });
    if (!vehicle || !(await ciudadesDelLote(lote.city)).includes(vehicle.section.cityId)) {
      return fallar("La unidad elegida no es de esta ciudad.");
    }
    if (!tipoAplicaEnApartado(item.tipo, vehicle.section.slug)) {
      return fallar(`"${tipoLoteLabel[item.tipo]}" no aplica en ${vehicle.section.name}.`);
    }

    // Igual que en la página de la unidad: con dos o más tanques cada uno
    // lleva sus propias pruebas; con uno solo se usa la ficha compartida.
    let tanqueId: string | null = null;
    if (esPruebaDeTanque(item.tipo) && vehicle.stationTankTechnicalSheets.length > 1) {
      if (!item.tanqueId || !vehicle.stationTankTechnicalSheets.some((t) => t.id === item.tanqueId)) {
        return fallar("Esta unidad tiene varios tanques: elige de cuál es la prueba.");
      }
      tanqueId = item.tanqueId;
    }

    const faltante = CAMPOS_POR_TIPO[item.tipo].find((def) => def.requerido && !item[def.campo]);
    if (faltante) return fallar(`Falta: ${faltante.etiqueta}.`);

    const original = await leerOriginalLote(lote.id, lote.storedName);
    const parte = await extraerPaginasPdf(original, item.paginaInicio, item.paginaFin);
    const archivo = new File([new Uint8Array(parte)], nombreArchivoItem(item, vehicle.numeroEconomico), {
      type: "application/pdf",
    });

    const resultado = await guardarEnBitacora(item, vehicle.id, tanqueId, formularioDeBitacora(item, archivo));
    if (resultado.error) return fallar(resultado.error);

    items[indice] = {
      ...item,
      tanqueId,
      estado: "GUARDADO",
      mensaje: `${resultado.success ?? "Guardado."} (${vehicle.numeroEconomico})`,
      resueltoPor: editor.username,
      resueltoEl: new Date().toISOString(),
    };
    await guardarItems(loteId, items);
    revalidatePath(rutaLote(lote.city.slug, loteId));
    return { success: items[indice].mensaje ?? "Guardado." };
  });
}

// Descartar no borra nada: solo marca que esas páginas no se van a guardar
// (una hoja de separación, un documento repetido...). Se puede deshacer.
export async function cambiarDescarteDocumentoDeLote(
  loteId: string,
  itemId: string,
  descartar: boolean,
  _prevState: ActionState
): Promise<ActionState> {
  const editor = await requireEditor();
  const lote = await prisma.loteDocumentos.findUnique({ where: { id: loteId }, include: { city: true } });
  if (!lote) return { error: "El lote no existe." };
  await assertCityAccessById(editor, lote.cityId);

  return conCandado(loteId, async () => {
    const actual = await prisma.loteDocumentos.findUnique({ where: { id: loteId } });
    if (!actual) return { error: "El lote no existe." };
    const items = leerItemsLote(actual.documentos);
    const item = items.find((i) => i.id === itemId);
    if (!item) return { error: "Ese documento ya no está en el lote." };
    if (item.estado === "GUARDADO") return { error: "Ese documento ya se guardó en su bitácora." };

    Object.assign(item, descartar
      ? { estado: "DESCARTADO", resueltoPor: editor.username, resueltoEl: new Date().toISOString() }
      : { estado: "PENDIENTE", resueltoPor: null, resueltoEl: null });
    await guardarItems(loteId, items);
    revalidatePath(rutaLote(lote.city.slug, loteId));
    return { success: descartar ? "Documento descartado." : "Documento restaurado." };
  });
}

const nuevoDocumentoSchema = z.object({
  tipo: z.enum(TIPOS_LOTE, { errorMap: () => ({ message: "Elige el tipo de documento" }) }),
  paginaInicio: z.coerce.number().int().min(1, "Página inicial inválida"),
  paginaFin: z.coerce.number().int().min(1, "Página final inválida"),
});

// Para lo que la IA no detectó, o para dividir el lote a mano cuando la
// lectura automática no está configurada.
export async function agregarDocumentoALote(
  loteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const lote = await prisma.loteDocumentos.findUnique({ where: { id: loteId }, include: { city: true } });
  if (!lote) return { error: "El lote no existe." };
  await assertCityAccessById(editor, lote.cityId);

  const parsed = nuevoDocumentoSchema.safeParse({
    tipo: formData.get("tipo"),
    paginaInicio: formData.get("paginaInicio"),
    paginaFin: formData.get("paginaFin"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { tipo, paginaInicio, paginaFin } = parsed.data;
  if (paginaFin < paginaInicio) return { error: "La página final no puede ser antes que la inicial." };
  if (paginaFin > lote.paginas) return { error: `El escaneo solo tiene ${lote.paginas} páginas.` };

  return conCandado(loteId, async () => {
    const actual = await prisma.loteDocumentos.findUnique({ where: { id: loteId } });
    if (!actual) return { error: "El lote no existe." };
    const items = leerItemsLote(actual.documentos);
    items.push({
      id: randomUUID(),
      origen: "MANUAL",
      paginaInicio,
      paginaFin,
      tipo,
      descripcionLector: null,
      vehicleId: null,
      tanqueId: null,
      identificador: null,
      compania: null,
      numero: null,
      responsable: null,
      fechaRealizacion: null,
      fechaAnterior: null,
      fechaProxima: null,
      fechaVencimiento: null,
      fechaFabricacion: null,
      calidad: null,
      tipoMantenimiento: null,
      tipoServicio: null,
      kilometraje: null,
      estatus: tipo === "MANTENIMIENTO" ? "TERMINADO" : null,
      descripcion: null,
      observaciones: null,
      dudas: [],
      estado: "PENDIENTE",
      mensaje: null,
      resueltoPor: null,
      resueltoEl: null,
    });
    items.sort((a, b) => a.paginaInicio - b.paginaInicio);
    await guardarItems(loteId, items);
    revalidatePath(rutaLote(lote.city.slug, loteId));
    return { success: "Documento agregado: complétalo en la lista y guárdalo." };
  });
}
