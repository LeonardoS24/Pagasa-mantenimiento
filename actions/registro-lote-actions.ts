"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { idsDeTrabajo } from "@/lib/ciudades-de-trabajo";
import { CAMPOS_POR_TIPO, itemLoteNuevo, tipoLoteLabel, type CampoItem, type TipoLote } from "@/lib/lote-documentos";
import { aplicaEnLote, esTipoEnLote } from "@/lib/registro-lote";
import { formularioDeBitacora, guardarEnBitacora } from "@/lib/bitacora-formulario";
import { MAX_FILAS_EXCEL, type FilaRegistro } from "@/lib/registros-excel";
import { previsualizarRegistros, type PrevisualizacionRegistros } from "@/lib/registros-excel-servidor";

// Registro en lote: cada unidad se guarda llamando a la MISMA acción que usa
// el formulario de su bitácora (con sus validaciones, su revisión de acceso a
// la ciudad y la actualización de la ficha). Aquí solo se arma el formulario
// de cada unidad mezclando lo general con lo propio de esa unidad.
//
// No es todo o nada: cada unidad se guarda por separado y se devuelve qué pasó
// con cada una, para poder corregir y reintentar solo las que fallaron.

export type EntradaRegistroLote = {
  tipo: string;
  comunes: Record<string, string>;
  filas: { vehicleId: string; propios: Record<string, string> }[];
  password: string;
};

// hoja y fila (el renglón del Excel) solo vienen cuando el registro salió de un
// Excel: así el navegador sabe exactamente cuál falló y no repite los buenos.
export type ResultadoUnidad = { vehicleId: string; nombre: string; ok: boolean; mensaje: string; tipo?: string; hoja?: string; fila?: number };
export type ResultadoRegistroLote = { error?: string; resultados?: ResultadoUnidad[] };

const MAX_UNIDADES = 300;

type Editor = Awaited<ReturnType<typeof requireEditor>>;
type CiudadConAcceso = Awaited<ReturnType<typeof assertCityAccess>>;

// Guarda, de un solo tipo, un registro por unidad. Los ids llegan del
// navegador: se vuelven a buscar y solo se aceptan unidades activas de las
// ciudades del usuario a las que el tipo aplica. Deja un renglón en la
// bitácora de actividad por tipo.
async function guardarFilas(
  editor: Editor,
  city: CiudadConAcceso,
  ids: string[],
  tipo: TipoLote,
  comunes: Record<string, string>,
  filas: { vehicleId: string; propios: Record<string, string> }[]
): Promise<ResultadoUnidad[]> {
  const idsUnicos = Array.from(new Set(filas.map((f) => f.vehicleId)));
  const unidades = await prisma.vehicleRecord.findMany({
    where: { id: { in: idsUnicos }, activo: true, section: { cityId: { in: ids } } },
    select: { id: true, numeroEconomico: true, section: { select: { slug: true } } },
  });
  const porId = new Map(unidades.map((u) => [u.id, u]));
  const defs = CAMPOS_POR_TIPO[tipo];
  const etiqueta = tipoLoteLabel[tipo];

  const resultados: ResultadoUnidad[] = [];
  const vistos = new Set<string>();
  for (const fila of filas) {
    if (vistos.has(fila.vehicleId)) continue;
    vistos.add(fila.vehicleId);
    const unidad = porId.get(fila.vehicleId);
    if (!unidad) {
      resultados.push({ vehicleId: fila.vehicleId, nombre: "Unidad", ok: false, mensaje: "Ya no existe, está dada de baja o no es de esta ciudad.", tipo });
      continue;
    }
    if (!aplicaEnLote(tipo, unidad.section.slug)) {
      resultados.push({ vehicleId: unidad.id, nombre: unidad.numeroEconomico, ok: false, mensaje: `A esta unidad no se le registra ${etiqueta} en lote.`, tipo });
      continue;
    }

    // Lo propio de la unidad pisa lo general; vacío = usa lo general.
    const valores: Partial<Record<CampoItem, string | null>> = {};
    const faltan: string[] = [];
    for (const def of defs) {
      const propio = String(fila.propios?.[def.campo] ?? "").trim();
      const comun = String(comunes?.[def.campo] ?? "").trim();
      const valor = propio || comun;
      valores[def.campo] = valor || null;
      if (def.requerido && !valor) faltan.push(def.etiqueta);
    }
    if (faltan.length > 0) {
      resultados.push({ vehicleId: unidad.id, nombre: unidad.numeroEconomico, ok: false, mensaje: `Falta: ${faltan.join(", ")}.`, tipo });
      continue;
    }

    const item = itemLoteNuevo({ id: "lote", origen: "MANUAL", paginaInicio: 1, paginaFin: 1, tipo, ...valores });
    try {
      const r = await guardarEnBitacora(item, unidad.id, null, formularioDeBitacora(item));
      if (r?.error) {
        resultados.push({ vehicleId: unidad.id, nombre: unidad.numeroEconomico, ok: false, mensaje: r.error, tipo });
      } else {
        resultados.push({ vehicleId: unidad.id, nombre: unidad.numeroEconomico, ok: true, mensaje: "Registrado.", tipo });
      }
    } catch (e) {
      resultados.push({
        vehicleId: unidad.id,
        nombre: unidad.numeroEconomico,
        ok: false,
        mensaje: e instanceof Error ? e.message : "No se pudo guardar.",
        tipo,
      });
    }
  }

  return resultados;
}

// Un renglón en la bitácora de actividad por tipo de registro, a nombre de
// quien lo guardó.
async function anotarActividad(editor: Editor, city: CiudadConAcceso, tipo: TipoLote, resultados: ResultadoUnidad[], origen: string) {
  const guardadas = resultados.filter((r) => r.ok);
  if (guardadas.length === 0) return;
  await logActivity({
    user: editor,
    accion: "EDITAR",
    entidad: `${origen}: ${tipoLoteLabel[tipo]}`,
    resumen: `${guardadas.length} registro(s)`,
    detalle: guardadas.map((r) => r.nombre).join(", ").slice(0, 900),
    citySlug: city.slug,
  });
}

function refrescar(citySlug: string) {
  revalidatePath(`/ciudades/${citySlug}`, "layout");
  revalidatePath("/dashboard");
}

export async function registrarEnLote(citySlug: string, entrada: EntradaRegistroLote): Promise<ResultadoRegistroLote> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };

  // Después de ver qué se va a registrar, quien lo guarda confirma con su
  // contraseña: queda a su nombre.
  const errorContrasena = await verifySessionPassword(editor, entrada?.password);
  if (errorContrasena) return { error: errorContrasena };

  if (!esTipoEnLote(entrada?.tipo)) return { error: "Tipo de registro inválido." };
  if (!Array.isArray(entrada.filas) || entrada.filas.length === 0) return { error: "Elige al menos una unidad." };
  if (entrada.filas.length > MAX_UNIDADES) return { error: `Son demasiadas unidades para una sola vez (máximo ${MAX_UNIDADES}).` };

  const city = await assertCityAccess(editor, citySlug);
  const ids = await idsDeTrabajo(editor, city);
  const resultados = await guardarFilas(editor, city, ids, entrada.tipo, entrada.comunes ?? {}, entrada.filas);
  await anotarActividad(editor, city, entrada.tipo, resultados, "Registro en lote");
  refrescar(city.slug);
  return { resultados };
}

// ── Registros nuevos desde Excel ─────────────────────────────────────────

const TAMANO_MAX = 10 * 1024 * 1024;

// Lee el Excel y devuelve qué se va a registrar y qué renglones tienen
// problema. NO guarda nada.
export async function revisarRegistrosExcel(citySlug: string, formData: FormData): Promise<PrevisualizacionRegistros> {
  const editor = await requireEditor();
  const city = await assertCityAccess(editor, citySlug);
  const vacio = { filas: [], problemas: [], hojasLeidas: [] };
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ...vacio, error: "Elige el archivo de Excel." };
  if (archivo.size > TAMANO_MAX) return { ...vacio, error: "El archivo pesa más de 10 MB." };
  if (!/\.xlsx?$/i.test(archivo.name)) return { ...vacio, error: "Tiene que ser un archivo de Excel (.xlsx)." };
  return previsualizarRegistros(Buffer.from(await archivo.arrayBuffer()), await idsDeTrabajo(editor, city));
}

// Guarda lo que se vio en la revisión, después de confirmar con la contraseña.
// Las filas llegan del navegador, así que se vuelve a validar todo: unidad,
// ciudad, obligatorios y las reglas de cada bitácora.
export async function aplicarRegistrosExcel(
  citySlug: string,
  filas: FilaRegistro[],
  password: string
): Promise<ResultadoRegistroLote> {
  const editor = await requireEditor();
  const sessionError = await checkSessionUserExists(editor);
  if (sessionError) return { error: sessionError };
  const errorContrasena = await verifySessionPassword(editor, password);
  if (errorContrasena) return { error: errorContrasena };

  if (!Array.isArray(filas) || filas.length === 0) return { error: "No hay registros que guardar." };
  if (filas.length > MAX_FILAS_EXCEL) return { error: `Son demasiados registros para una sola carga (máximo ${MAX_FILAS_EXCEL}).` };

  const city = await assertCityAccess(editor, citySlug);
  const ids = await idsDeTrabajo(editor, city);

  const resultados: ResultadoUnidad[] = [];
  for (const tipo of Array.from(new Set(filas.map((f) => f.tipo)))) {
    if (!esTipoEnLote(tipo)) {
      resultados.push({ vehicleId: "", nombre: "Hoja", ok: false, mensaje: "Tipo de registro inválido.", tipo });
      continue;
    }
    // Un registro por renglón: aunque una unidad repita en la hoja, cada
    // renglón se guarda (guardarFilas junta por unidad, así que va uno a uno).
    const deEste: ResultadoUnidad[] = [];
    for (const f of filas.filter((x) => x.tipo === tipo)) {
      const propios = Object.fromEntries(Object.entries(f.valores ?? {}).map(([k, v]) => [k, String(v ?? "")]));
      const r = await guardarFilas(editor, city, ids, tipo, {}, [{ vehicleId: String(f.vehicleId), propios }]);
      deEste.push(...r.map((x) => ({ ...x, hoja: f.hoja, fila: f.fila })));
    }
    await anotarActividad(editor, city, tipo, deEste, "Registros desde Excel");
    resultados.push(...deEste);
  }
  refrescar(city.slug);
  return { resultados };
}
