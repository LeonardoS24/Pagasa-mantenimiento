"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertCityAccessById } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
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
  itemLoteNuevo,
  adivinarUnidadPorNombre,
  type ItemLote,
  type CampoItem,
  type TipoLote,
} from "@/lib/lote-documentos";
import {
  guardarOriginalLote,
  leerOriginalLote,
  contarPaginasPdf,
  extraerPaginasPdf,
  unirPdfs,
  borrarCarpetaLote,
} from "@/lib/lote-documentos-archivos";
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

// Unidades de las ciudades del lote, para adivinar a cuál va cada archivo
// por su nombre (ver adivinarUnidadPorNombre).
async function unidadesParaAdivinar(cityIds: string[]) {
  const registros = await prisma.vehicleRecord.findMany({
    where: { section: { cityId: { in: cityIds } } },
    select: { id: true, numeroEconomico: true, section: { select: { slug: true } } },
  });
  return registros.map((r) => ({ id: r.id, numeroEconomico: r.numeroEconomico, sectionSlug: r.section.slug }));
}

const tipoOpcionalSchema = z.preprocess((v) => (v ? v : undefined), z.enum(TIPOS_LOTE).optional());

// Un solo PDF con todo junto (la IA lo separa, o se separa a mano) o varios
// PDF a la vez: en ese caso cada archivo ya es un documento, así que se
// crea uno por archivo con la unidad adivinada por su nombre y el tipo que
// se haya elegido para todos.
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

  const archivos = formData.getAll("archivo").filter((v): v is File => v instanceof File && v.size > 0);
  if (archivos.length === 0) return { error: "Selecciona el PDF escaneado." };
  for (const archivo of archivos) {
    if (archivo.type !== "application/pdf") return { error: `"${archivo.name}" no es un PDF.` };
  }
  const tamanoTotal = archivos.reduce((t, a) => t + a.size, 0);
  if (tamanoTotal > MAX_LOTE_BYTES) {
    return {
      error:
        archivos.length === 1
          ? `"${archivos[0].name}" supera 20 MB. Escanéalo en dos partes o con menor resolución.`
          : "Entre todos los archivos suman más de 20 MB. Súbelos en dos tandas.",
    };
  }
  const tipoComun = tipoOpcionalSchema.safeParse(formData.get("tipo"));
  if (!tipoComun.success) return { error: "Tipo de documento inválido." };

  const datos = await Promise.all(archivos.map(async (a) => Buffer.from(await a.arrayBuffer())));
  let pdf: Buffer;
  let paginas: number;
  let items: ItemLote[] = [];
  try {
    if (archivos.length === 1) {
      pdf = datos[0];
      paginas = await contarPaginasPdf(pdf);
    } else {
      const unido = await unirPdfs(datos);
      pdf = unido.pdf;
      paginas = unido.rangos.at(-1)?.paginaFin ?? 0;
      const tipo: TipoLote = tipoComun.data ?? "UNIDAD";
      const unidades = await unidadesParaAdivinar(await ciudadesDelLote(city));
      items = archivos.map((archivo, i) => {
        const unidad = adivinarUnidadPorNombre(archivo.name, unidades, tipo);
        return itemLoteNuevo({
          id: randomUUID(),
          origen: "MANUAL",
          ...unido.rangos[i],
          tipo,
          descripcionLector: `Archivo: ${archivo.name}`,
          vehicleId: unidad?.id ?? null,
          identificador: unidad ? `Nombre del archivo: ${archivo.name}` : null,
          dudas: unidad ? [] : ["No se reconoció la unidad en el nombre del archivo: elígela."],
        });
      });
    }
  } catch {
    return { error: "No se pudo abrir uno de los PDF. ¿Está dañado o protegido con contraseña?" };
  }
  if (paginas === 0) return { error: "El PDF no tiene páginas." };

  // La IA solo lee un escaneo con todo junto: con varios archivos ya se sabe
  // dónde empieza y termina cada documento.
  const conIA = archivos.length === 1 && lectorConfigurado();
  const lote = await prisma.loteDocumentos.create({
    data: {
      cityId: city.id,
      fileName: archivos.length === 1 ? archivos[0].name : `${archivos.length} archivos (${archivos[0].name}, ...)`,
      storedName: "",
      size: pdf.length,
      paginas,
      // Sin clave de la API el lote se divide a mano desde la revisión.
      estado: conIA ? "ANALIZANDO" : "POR_REVISAR",
      documentos: JSON.stringify(items),
      createdById: editor.userId,
    },
  });
  const storedName = await guardarOriginalLote(lote.id, pdf);
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

const filaSchema = z.object({
  tipo: z.enum(TIPOS_LOTE, { errorMap: () => ({ message: "Elige el tipo de documento" }) }),
  paginaInicio: z.coerce.number({ invalid_type_error: "Página inicial inválida" }).int().min(1, "Página inicial inválida"),
  paginaFin: z.coerce.number({ invalid_type_error: "Página final inválida" }).int().min(1, "Página final inválida"),
  vehicleId: textoONulo,
});

// Varios documentos de un jalón: cada fila es un rango de páginas con su
// tipo y (opcional) su unidad, p. ej. "1 a 3, hermeticidad, PH10" y "4 a 6,
// hermeticidad, PH9". Sirve para lo que la IA no detectó o para dividir a
// mano el escaneo cuando la lectura automática no está configurada. Si una
// fila está mal no se agrega ninguna, para no dejar el lote a medias.
export async function agregarDocumentosALote(
  loteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const lote = await prisma.loteDocumentos.findUnique({ where: { id: loteId }, include: { city: true } });
  if (!lote) return { error: "El lote no existe." };
  await assertCityAccessById(editor, lote.cityId);
  if (lote.estado === "ANALIZANDO") return { error: "Espera a que termine la lectura del lote." };

  const tipos = formData.getAll("tipo");
  const desdes = formData.getAll("paginaInicio");
  const hastas = formData.getAll("paginaFin");
  const unidades = formData.getAll("vehicleId");
  if (tipos.length === 0) return { error: "Agrega al menos un renglón." };
  if (tipos.length > 200) return { error: "Son demasiados renglones de una vez (máximo 200)." };

  const ciudades = await ciudadesDelLote(lote.city);
  const filas: z.infer<typeof filaSchema>[] = [];
  for (let i = 0; i < tipos.length; i++) {
    const fila = filaSchema.safeParse({
      tipo: tipos[i],
      paginaInicio: desdes[i],
      paginaFin: hastas[i],
      vehicleId: unidades[i],
    });
    const renglon = `Renglón ${i + 1}: `;
    if (!fila.success) return { error: renglon + (fila.error.issues[0]?.message ?? "datos inválidos") };
    const { paginaInicio, paginaFin, vehicleId } = fila.data;
    if (paginaFin < paginaInicio) return { error: renglon + "la página final no puede ser antes que la inicial." };
    if (paginaFin > lote.paginas) return { error: renglon + `el escaneo solo tiene ${lote.paginas} páginas.` };
    // La unidad llega del navegador: se confirma que sea de este lote.
    if (vehicleId) {
      const vehicle = await prisma.vehicleRecord.findUnique({
        where: { id: vehicleId },
        select: { section: { select: { cityId: true } } },
      });
      if (!vehicle || !ciudades.includes(vehicle.section.cityId)) {
        return { error: renglon + "la unidad elegida no es de esta ciudad." };
      }
    }
    filas.push(fila.data);
  }

  return conCandado(loteId, async () => {
    const actual = await prisma.loteDocumentos.findUnique({ where: { id: loteId } });
    if (!actual) return { error: "El lote no existe." };
    const items = leerItemsLote(actual.documentos);
    for (const fila of filas) {
      items.push(itemLoteNuevo({ id: randomUUID(), origen: "MANUAL", ...fila }));
    }
    items.sort((a, b) => a.paginaInicio - b.paginaInicio);
    await guardarItems(loteId, items);
    revalidatePath(rutaLote(lote.city.slug, loteId));
    return {
      success:
        filas.length === 1
          ? "Documento agregado: complétalo en la lista y guárdalo."
          : `${filas.length} documentos agregados: complétalos en la lista y guárdalos.`,
    };
  });
}

// Quita un documento de la lista del lote (la IA o quien capturó se pudo
// equivocar). Uno que ya se guardó no se quita desde aquí: su registro ya
// está en la bitácora de la unidad y se borra allá, con la contraseña, como
// cualquier otro registro.
export async function eliminarDocumentoDeLote(
  loteId: string,
  itemId: string,
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
    if (item.estado === "GUARDADO") {
      return { error: "Ese documento ya se guardó: bórralo desde la página de la unidad." };
    }
    await guardarItems(
      loteId,
      items.filter((i) => i.id !== itemId)
    );
    revalidatePath(rutaLote(lote.city.slug, loteId));
    return { success: "Documento quitado del lote." };
  });
}

// Elimina un lote completo con su escaneo, solo si no se guardó nada de él
// en las bitácoras: si ya se guardó algo, el escaneo es la evidencia de esos
// registros y se conserva. Pide la contraseña y queda en la bitácora de
// auditoría, como cualquier borrado (ver lib/reauth.ts).
export async function eliminarLoteDocumentos(
  loteId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const editor = await requireEditor();
  const lote = await prisma.loteDocumentos.findUnique({ where: { id: loteId }, include: { city: true } });
  if (!lote) return { error: "El lote ya no existe." };
  await assertCityAccessById(editor, lote.cityId);

  const passwordError = await verifySessionPassword(editor, formData.get("password"));
  if (passwordError) return { error: passwordError };

  const resultado = await conCandado(loteId, async (): Promise<ActionState> => {
    const actual = await prisma.loteDocumentos.findUnique({ where: { id: loteId } });
    if (!actual) return { error: "El lote ya no existe." };
    const guardados = leerItemsLote(actual.documentos).filter((i) => i.estado === "GUARDADO").length;
    if (guardados > 0) {
      return {
        error: `No se puede eliminar: ${guardados} documento(s) de este lote ya están en las bitácoras y el escaneo es su evidencia.`,
      };
    }
    if (actual.estado === "ANALIZANDO") return { error: "Espera a que termine la lectura del lote." };

    await logActivity({
      user: editor,
      accion: "ELIMINAR",
      entidad: "Lote de documentos escaneados",
      resumen: `${actual.fileName} (${actual.paginas} páginas)`,
      citySlug: lote.city.slug,
    });
    await borrarCarpetaLote(loteId);
    await prisma.loteDocumentos.delete({ where: { id: loteId } });
    return { success: "Lote eliminado." };
  });
  if (resultado.error) return resultado;

  revalidatePath(`/ciudades/${lote.city.slug}/carga-de-documentos`);
  redirect(`/ciudades/${lote.city.slug}/carga-de-documentos`);
}
