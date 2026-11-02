"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEditor, checkSessionUserExists } from "@/lib/auth";
import { assertCityAccess } from "@/lib/access";
import { verifySessionPassword } from "@/lib/reauth";
import { logActivity } from "@/lib/activity-log";
import { idsDeTrabajo } from "@/lib/ciudades-de-trabajo";
import { CAMPOS_POR_TIPO, itemLoteNuevo, tipoLoteLabel, type CampoItem, type TipoLote } from "@/lib/lote-documentos";
import { aplicaEnLote, camposObligatoriosEnLote, claveDeNumero, esTipoEnLote, numeroObligatorioEnLote, numerosRepetidos } from "@/lib/registro-lote";
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

  const obligatorios = new Set<CampoItem>(camposObligatoriosEnLote(tipo));

  // Primero se arma lo que llevaría cada unidad, para poder avisar de los
  // números repetidos en el mismo envío antes de guardar nada.
  const armadas: { unidad: NonNullable<ReturnType<typeof porId.get>>; valores: Partial<Record<CampoItem, string | null>>; faltan: string[] }[] = [];
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
      if (obligatorios.has(def.campo) && !valor) faltan.push(def.etiqueta);
    }
    armadas.push({ unidad, valores, faltan });
  }

  // Cada unidad trae su propio número: dos con el mismo casi siempre es un
  // error de captura, así que ninguna de las dos se guarda hasta corregirlo.
  const repetidos = new Map<string, { numero: string; unidades: string[] }>();
  if (numeroObligatorioEnLote(tipo)) {
    for (const g of numerosRepetidos(armadas.map((a) => ({ unidad: a.unidad.numeroEconomico, numero: a.valores.numero ?? "" })))) {
      repetidos.set(claveDeNumero(g.numero), g);
    }
  }

  for (const { unidad, valores, faltan } of armadas) {
    if (faltan.length > 0) {
      resultados.push({ vehicleId: unidad.id, nombre: unidad.numeroEconomico, ok: false, mensaje: `Falta: ${faltan.join(", ")}.`, tipo });
      continue;
    }
    const repetido = repetidos.get(claveDeNumero(valores.numero ?? ""));
    if (repetido) {
      const otras = repetido.unidades.filter((u) => u !== unidad.numeroEconomico).join(", ");
      resultados.push({
        vehicleId: unidad.id,
        nombre: unidad.numeroEconomico,
        ok: false,
        mensaje: `El número «${repetido.numero}» también se puso en ${otras}. Cada unidad lleva el suyo.`,
        tipo,
      });
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

export type NumeroYaUsado = { vehicleId: string; numero: string; usadoEn: string };

// Antes de confirmar: ¿alguno de estos números ya está en la bitácora de otra
// unidad (o de la misma)? Solo avisa, no bloquea: puede ser una corrección
// a propósito. Solo mira unidades de las ciudades del usuario.
export async function revisarNumerosEnLote(
  citySlug: string,
  tipo: string,
  filas: { vehicleId: string; numero: string }[]
): Promise<{ error?: string; avisos: NumeroYaUsado[] }> {
  const editor = await requireEditor();
  if (!esTipoEnLote(tipo) || !numeroObligatorioEnLote(tipo)) return { avisos: [] };
  if (!Array.isArray(filas) || filas.length > MAX_UNIDADES) return { error: "Son demasiadas unidades.", avisos: [] };
  const city = await assertCityAccess(editor, citySlug);
  const ids = await idsDeTrabajo(editor, city);

  const numeros = Array.from(new Set(filas.map((f) => String(f.numero ?? "").trim()).filter(Boolean)));
  if (numeros.length === 0) return { avisos: [] };

  // Se traen los números de la ciudad y se comparan aquí sin importar
  // mayúsculas, espacios ni guiones («US-12» = «us 12»): la base solo
  // compara exacto y las tablas son chicas.
  const seleccion = {
    fechaRealizacion: true,
    vehicleRecord: { select: { numeroEconomico: true, section: { select: { cityId: true } } } },
  } as const;
  const dondeUnidad = { vehicleRecord: { section: { cityId: { in: ids } } } };
  let hallados: { numero: string | null; fechaRealizacion: Date; vehicleRecord: { numeroEconomico: string } }[] = [];
  switch (tipo) {
    case "ULTRASONIDO":
      hallados = (await prisma.ultrasoundLog.findMany({ where: { numeroUltrasonido: { not: null }, ...dondeUnidad }, select: { numeroUltrasonido: true, ...seleccion } })).map((r) => ({ ...r, numero: r.numeroUltrasonido }));
      break;
    case "VISUAL_EXTERNA":
      hallados = (await prisma.visualInspectionLog.findMany({ where: { numeroInspeccion: { not: null }, ...dondeUnidad }, select: { numeroInspeccion: true, ...seleccion } })).map((r) => ({ ...r, numero: r.numeroInspeccion }));
      break;
    case "VISUAL_INTERNA":
      hallados = (await prisma.internalVisualInspectionLog.findMany({ where: { numeroInspeccion: { not: null }, ...dondeUnidad }, select: { numeroInspeccion: true, ...seleccion } })).map((r) => ({ ...r, numero: r.numeroInspeccion }));
      break;
    case "HERMETICIDAD":
      hallados = (await prisma.tightnessTestLog.findMany({ where: { numeroPrueba: { not: null }, ...dondeUnidad }, select: { numeroPrueba: true, ...seleccion } })).map((r) => ({ ...r, numero: r.numeroPrueba }));
      break;
    case "HIDROSTATICA":
      hallados = (await prisma.hydrostaticTestLog.findMany({ where: { numeroPrueba: { not: null }, ...dondeUnidad }, select: { numeroPrueba: true, ...seleccion } })).map((r) => ({ ...r, numero: r.numeroPrueba }));
      break;
    default:
      return { avisos: [] };
  }

  const dmy = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join("/");
  const avisos: NumeroYaUsado[] = [];
  for (const f of filas) {
    const n = String(f.numero ?? "").trim();
    if (!n) continue;
    const previos = hallados.filter((h) => h.numero !== null && claveDeNumero(h.numero) === claveDeNumero(n));
    if (previos.length === 0) continue;
    avisos.push({
      vehicleId: f.vehicleId,
      numero: n,
      usadoEn: previos.map((p) => `${p.vehicleRecord.numeroEconomico} (${dmy(p.fechaRealizacion)})`).join(", "),
    });
  }
  return { avisos };
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
