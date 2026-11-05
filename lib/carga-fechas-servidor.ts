import { prisma } from "./prisma";
import { XLSX, escribirLibro, hojaConFormato } from "./excel-formato";
import { logActivity } from "./activity-log";
import { isAggregateCitySlug } from "./aggregate-city";
import { getOpcionesDeTraspaso, trasladarUnidad } from "./traspaso-unidades";
import type { UsuarioSesion } from "./session";
import {
  APARTADOS_CON_PLANTILLA,
  PALABRA_BORRAR,
  claveDeCiudad,
  columnasDeApartado,
  columnasDeTextoDeApartado,
  leerFecha,
  leerTexto,
  textoFecha,
  type CambioCarga,
  type ColumnaTexto,
  type ProblemaCarga,
} from "./carga-fechas";

// Plantilla de Excel y lectura de la que regresa (ver lib/carga-fechas.ts).
// Trae fechas, datos de texto (marca, placas, chofer, tanque...) y la ciudad.

const HOJA_DE_APARTADO: Record<string, string> = {
  "auto-tanques": "Auto-Tanques",
  semirremolques: "Semirremolques",
  "vehiculo-con-tanque-de-carburacion": "Carburación",
  tractocamiones: "Tractocamiones",
  "vehiculo-de-reparto": "Reparto",
  "unidades-utilitarias": "Utilitarias",
};
const APARTADO_DE_HOJA = Object.fromEntries(Object.entries(HOJA_DE_APARTADO).map(([a, h]) => [h, a]));
const COL_ID = "Id del sistema";
const COL_CIUDAD = "Ciudad";
const COL_NUMERO = "Número económico";
const CARBURACION = "vehiculo-con-tanque-de-carburacion";

async function unidadesDe(cityIds: string[]) {
  return prisma.vehicleRecord.findMany({
    where: { activo: true, section: { cityId: { in: cityIds }, slug: { in: [...APARTADOS_CON_PLANTILLA] } } },
    include: { technicalSheet: true, section: { include: { city: true } } },
    orderBy: [{ section: { city: { order: "asc" } } }, { numeroEconomico: "asc" }],
  });
}
type Unidad = Awaited<ReturnType<typeof unidadesDe>>[number];

async function ciudadesReales() {
  const todas = await prisma.city.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }], select: { id: true, name: true, slug: true } });
  return todas.filter((c) => !isAggregateCitySlug(c.slug));
}

// Valor de texto guardado hoy; "" cuenta como vacío (sucursal no es nullable).
function textoActual(unidad: Unidad, c: ColumnaTexto): string | null {
  const fuente = c.tabla === "unidad" ? (unidad as unknown as Record<string, unknown>) : (unidad.technicalSheet as unknown as Record<string, unknown> | null);
  const valor = fuente?.[c.campo];
  return typeof valor === "string" && valor.trim() !== "" ? valor : null;
}

// La pareja del formulario (sincronizarFichaAutomovil en actions/vehicle-actions.ts):
// carburación <-> la unidad del mismo número económico en la misma ciudad.
function parejaDe(unidad: Unidad, todas: Unidad[]): Unidad | null {
  const esCarb = unidad.section.slug === CARBURACION;
  return (
    todas.find(
      (o) =>
        o.id !== unidad.id &&
        o.numeroEconomico === unidad.numeroEconomico &&
        o.section.cityId === unidad.section.cityId &&
        (esCarb ? o.section.slug !== CARBURACION : o.section.slug === CARBURACION)
    ) ?? null
  );
}

function instrucciones(ciudades: { name: string }[]) {
  return [
    ["Cómo usar esta plantilla"],
    [""],
    ["1. Cada hoja es un tipo de unidad. Cada renglón es una unidad; cada columna, un dato de su ficha."],
    ["2. Puedes cambiar datos de texto (marca, año, placas, observaciones, automóvil, chofer y póliza, tanque) y fechas."],
    ["3. Las fechas van en formato dd/mm/aaaa (por ejemplo 05/03/2024)."],
    ["4. Una celda vacía NO borra nada. Para borrar un dato guardado escribe " + PALABRA_BORRAR + " (marca, año y placas son obligatorios: no se borran)."],
    ["5. Para cambiar una unidad de ciudad escribe el nombre de la ciudad nueva en «" + COL_CIUDAD + "». Solo lo aplica un administrador;"],
    ["    el Auto-Tanque y su Vehículo con tanque de carburación se mueven juntos, y una unidad que va en un conjunto de Kino no se mueve."],
    ["    Ciudades: " + ciudades.map((c) => c.name).join(", ") + "."],
    ["6. Lo del «Automóvil» y «Chofer y póliza» se copia a la pareja Auto-Tanque / carburación, igual que en la ficha."],
    ["7. No cambies los encabezados ni la columna «" + COL_ID + "»: es como el sistema sabe de qué unidad es cada renglón."],
    ["8. Súbela en «Datos desde Excel»: el sistema te muestra cada cambio (antes → después) y no guarda nada hasta que lo confirmes."],
    [""],
    ["Las estaciones y la planta no vienen aquí: sus pruebas y válvulas van por tanque, en su propia ficha."],
  ];
}

export async function armarPlantilla(cityIds: string[]): Promise<Buffer> {
  const [unidades, ciudades] = await Promise.all([unidadesDe(cityIds), ciudadesReales()]);
  const libro = XLSX.utils.book_new();
  const hojaInstrucciones = XLSX.utils.aoa_to_sheet(instrucciones(ciudades));
  hojaInstrucciones["!cols"] = [{ wch: 130 }];
  XLSX.utils.book_append_sheet(libro, hojaInstrucciones, "Instrucciones");

  for (const slug of APARTADOS_CON_PLANTILLA) {
    const deEste = unidades.filter((u) => u.section.slug === slug);
    if (deEste.length === 0) continue;
    const fechas = columnasDeApartado(slug);
    const textos = columnasDeTextoDeApartado(slug);
    const encabezados = [COL_CIUDAD, COL_NUMERO, ...textos.map((c) => c.encabezado), ...fechas.map((c) => c.encabezado), COL_ID];
    const filas = deEste.map((u) => {
      const fila: Record<string, string> = { [COL_CIUDAD]: u.section.city.name, [COL_NUMERO]: u.numeroEconomico, [COL_ID]: u.id };
      for (const c of textos) fila[c.encabezado] = textoActual(u, c) ?? "";
      for (const c of fechas) fila[c.encabezado] = textoFecha(u.technicalSheet?.[c.campo] as Date | null | undefined);
      return fila;
    });
    XLSX.utils.book_append_sheet(libro, hojaConFormato(filas, encabezados), HOJA_DE_APARTADO[slug]);
  }
  return escribirLibro(libro);
}

export type Previsualizacion = { cambios: CambioCarga[]; problemas: ProblemaCarga[]; filasLeidas: number };

export async function previsualizar(buffer: Buffer, cityIds: string[], esAdmin: boolean): Promise<Previsualizacion> {
  let libro: XLSX.WorkBook;
  try {
    libro = XLSX.read(buffer, { type: "buffer", cellDates: true });
  } catch {
    return { cambios: [], problemas: [{ hoja: "", fila: 0, mensaje: "No se pudo leer el archivo. ¿Es la plantilla en Excel (.xlsx)?" }], filasLeidas: 0 };
  }
  const [lista, ciudades] = await Promise.all([unidadesDe(cityIds), ciudadesReales()]);
  const unidades = new Map(lista.map((u) => [u.id, u]));
  const ciudadPorClave = new Map(ciudades.map((c) => [claveDeCiudad(c.name), c]));
  const cambios: CambioCarga[] = [];
  const problemas: ProblemaCarga[] = [];
  // Dónde está el renglón de cada unidad, para los avisos de la pareja.
  const filaDe = new Map<string, { hoja: string; fila: number }>();
  let filasLeidas = 0;

  for (const nombreHoja of libro.SheetNames) {
    const slug = APARTADO_DE_HOJA[nombreHoja];
    if (!slug) continue;
    const fechas = columnasDeApartado(slug);
    const textos = columnasDeTextoDeApartado(slug);
    const filas = XLSX.utils.sheet_to_json<Record<string, unknown>>(libro.Sheets[nombreHoja], { defval: null, raw: true });
    for (const [i, fila] of filas.entries()) {
      const numeroFila = i + 2; // la 1 es el encabezado
      const id = String(fila[COL_ID] ?? "").trim();
      if (!id) {
        if (Object.values(fila).some((v) => v !== null && String(v).trim() !== "")) {
          problemas.push({ hoja: nombreHoja, fila: numeroFila, mensaje: `Sin «${COL_ID}»: no se sabe de qué unidad es.` });
        }
        continue;
      }
      const unidad = unidades.get(id);
      if (!unidad) {
        problemas.push({ hoja: nombreHoja, fila: numeroFila, mensaje: "Esa unidad no existe, está dada de baja o no es de esta ciudad." });
        continue;
      }
      if (unidad.section.slug !== slug) {
        problemas.push({ hoja: nombreHoja, fila: numeroFila, mensaje: `${unidad.numeroEconomico} no es de esta hoja (${nombreHoja}).` });
        continue;
      }
      if (filaDe.has(unidad.id)) {
        problemas.push({ hoja: nombreHoja, fila: numeroFila, mensaje: `${unidad.numeroEconomico} viene repetida en la hoja: se toma solo el primer renglón.` });
        continue;
      }
      filaDe.set(unidad.id, { hoja: nombreHoja, fila: numeroFila });
      filasLeidas++;
      const base = { vehicleId: unidad.id, numeroEconomico: unidad.numeroEconomico, apartado: nombreHoja };

      for (const c of textos) {
        if (!(c.encabezado in fila)) continue;
        const leido = leerTexto(fila[c.encabezado], c);
        if (leido.tipo === "vacio") continue;
        if (leido.tipo === "error") {
          problemas.push({ hoja: nombreHoja, fila: numeroFila, mensaje: `${unidad.numeroEconomico}, ${c.encabezado}: ${leido.texto}.` });
          continue;
        }
        const actual = textoActual(unidad, c);
        const nuevo = leido.tipo === "borrar" ? null : leido.texto;
        // leerTexto junta espacios: un dato viejo con dobles espacios o
        // saltos de línea que nadie tocó no cuenta como cambio.
        if (nuevo === (actual === null ? null : actual.replace(/\s+/g, " ").trim())) continue;
        cambios.push({ ...base, tipo: "texto", campo: c.campo, etiqueta: c.encabezado, antes: actual, despues: nuevo });
      }

      for (const c of fechas) {
        if (!(c.encabezado in fila)) continue;
        const leido = leerFecha(fila[c.encabezado]);
        const actual = (unidad.technicalSheet?.[c.campo] as Date | null | undefined) ?? null;
        if (leido.tipo === "vacio") continue;
        if (leido.tipo === "error") {
          problemas.push({ hoja: nombreHoja, fila: numeroFila, mensaje: `${unidad.numeroEconomico}, ${c.encabezado}: ${leido.texto}.` });
          continue;
        }
        const nueva = leido.tipo === "borrar" ? null : leido.fecha;
        if ((nueva?.getTime() ?? null) === (actual?.getTime() ?? null)) continue;
        cambios.push({ ...base, tipo: "fecha", campo: c.campo, etiqueta: c.encabezado, antes: actual?.toISOString() ?? null, despues: nueva?.toISOString() ?? null });
      }

      // Ciudad: escribir otra cambia la unidad de ciudad (traspaso).
      const textoCiudad = String(fila[COL_CIUDAD] ?? "").trim();
      if (textoCiudad && claveDeCiudad(textoCiudad) !== claveDeCiudad(unidad.section.city.name)) {
        const destino = ciudadPorClave.get(claveDeCiudad(textoCiudad));
        const problema = (mensaje: string) => problemas.push({ hoja: nombreHoja, fila: numeroFila, mensaje: `${unidad.numeroEconomico}, ${COL_CIUDAD}: ${mensaje}` });
        if (!destino) {
          problema(`«${textoCiudad}» no es una ciudad del sistema (${ciudades.map((c) => c.name).join(", ")}).`);
        } else if (!esAdmin) {
          problema("solo un administrador puede cambiar unidades de ciudad.");
        } else {
          const opciones = await getOpcionesDeTraspaso(unidad.id);
          if (opciones.bloqueo) problema(opciones.bloqueo);
          else if (!opciones.ciudades.some((c) => c.id === destino.id)) problema(`no se puede pasar a ${destino.name} (no tiene el apartado de este tipo de unidad).`);
          else
            cambios.push({
              ...base,
              tipo: "ciudad",
              campo: destino.id,
              etiqueta: COL_CIUDAD,
              antes: unidad.section.city.name,
              despues: destino.name,
              nota: opciones.par ? `Se va junto con su pareja ${opciones.par.numeroEconomico} (${opciones.par.apartado}).` : undefined,
            });
        }
      }
    }
  }

  return { cambios: resolverParejas(cambios, problemas, lista, filaDe), problemas, filasLeidas };
}

// La pareja Auto-Tanque / carburación (o reparto / carburación) es el mismo
// camión: lo del Automóvil se copia a la otra ficha, y si cambia de ciudad se
// van las dos. Aquí se agrega lo que se copia y se quitan los choques.
function resolverParejas(
  cambios: CambioCarga[],
  problemas: ProblemaCarga[],
  todas: Unidad[],
  filaDe: Map<string, { hoja: string; fila: number }>
): CambioCarga[] {
  const porId = new Map(todas.map((u) => [u.id, u]));
  const clave = (c: { vehicleId: string; tipo: string; campo: string }) => `${c.vehicleId}|${c.tipo}|${c.tipo === "ciudad" ? "" : c.campo}`;
  const existentes = new Map(cambios.map((c) => [clave(c), c]));
  const quitar = new Set<CambioCarga>();
  const agregados: CambioCarga[] = [];
  const avisar = (unidadId: string, mensaje: string) => {
    const donde = filaDe.get(unidadId) ?? { hoja: "", fila: 0 };
    problemas.push({ ...donde, mensaje });
  };

  for (const c of cambios) {
    if (quitar.has(c)) continue;
    const unidad = porId.get(c.vehicleId)!;
    const sincroniza = c.tipo === "ciudad" || (c.tipo === "texto" && columnasDeTextoDeApartado(unidad.section.slug).find((col) => col.campo === c.campo)?.pareja);
    if (!sincroniza) continue;
    const pareja = parejaDe(unidad, todas);
    if (!pareja) continue;
    const suyo = existentes.get(clave({ vehicleId: pareja.id, tipo: c.tipo, campo: c.campo }));

    if (c.tipo === "ciudad") {
      // Basta un cambio por pareja: el traspaso mueve a las dos.
      if (!suyo) continue;
      if (suyo.despues === c.despues) {
        quitar.add(suyo);
      } else {
        quitar.add(c).add(suyo);
        avisar(unidad.id, `${unidad.numeroEconomico}: su renglón dice ${c.despues} y el de su pareja (${HOJA_DE_APARTADO[pareja.section.slug]}) dice ${suyo.despues}. Se mueven juntas: pon la misma ciudad en las dos.`);
      }
      continue;
    }

    if (suyo) {
      if (suyo.despues !== c.despues) {
        quitar.add(c).add(suyo);
        avisar(unidad.id, `${unidad.numeroEconomico}, ${c.etiqueta}: no coincide con lo que dice su pareja en ${HOJA_DE_APARTADO[pareja.section.slug]} («${c.despues ?? PALABRA_BORRAR}» y «${suyo.despues ?? PALABRA_BORRAR}»). Es el mismo vehículo: pon lo mismo en las dos.`);
      }
      continue;
    }
    const columna = columnasDeTextoDeApartado(pareja.section.slug).find((col) => col.campo === c.campo);
    if (!columna) continue;
    if (textoActual(pareja, columna) === c.despues) continue;
    const copia: CambioCarga = {
      vehicleId: pareja.id,
      numeroEconomico: pareja.numeroEconomico,
      apartado: HOJA_DE_APARTADO[pareja.section.slug],
      tipo: "texto",
      campo: c.campo,
      etiqueta: columna.encabezado,
      antes: textoActual(pareja, columna),
      despues: c.despues,
      nota: `Se copia de su pareja en ${c.apartado} (es el mismo vehículo).`,
    };
    existentes.set(clave(copia), copia);
    agregados.push(copia);
  }
  return [...cambios.filter((c) => !quitar.has(c)), ...agregados];
}

export type ResultadoAplicar = { aplicados: number; unidades: number; traspasos: number; omitidos: string[]; ciudadesTocadas: string[] };

// Los cambios llegan del navegador: se revalida TODO (ciudad, campo permitido
// para ese tipo de unidad, valor) y se omite lo que cambió en el sistema desde
// la vista previa (alguien lo editó mientras tanto).
export async function aplicarCambios(cambios: CambioCarga[], cityIds: string[], user: UsuarioSesion, esAdmin: boolean): Promise<ResultadoAplicar> {
  const unidades = new Map((await unidadesDe(cityIds)).map((u) => [u.id, u]));
  const ciudades = new Map((await ciudadesReales()).map((c) => [c.id, c]));
  const datosUnidad = new Map<string, Record<string, string | null>>();
  const datosFicha = new Map<string, Record<string, Date | string | null>>();
  const resumen = new Map<string, string[]>();
  const traspasos = new Map<string, { destinoId: string }>();
  const omitidos: string[] = [];

  const anotar = (vehicleId: string, linea: string) => resumen.set(vehicleId, [...(resumen.get(vehicleId) ?? []), linea]);

  for (const c of cambios) {
    const unidad = unidades.get(c.vehicleId);
    if (!unidad) {
      omitidos.push(`${c.numeroEconomico}: ya no está disponible.`);
      continue;
    }
    const slug = unidad.section.slug;

    if (c.tipo === "ciudad") {
      const destino = ciudades.get(c.campo);
      if (!esAdmin) omitidos.push(`${c.numeroEconomico}: solo un administrador puede cambiar unidades de ciudad.`);
      else if (!destino) omitidos.push(`${c.numeroEconomico}: la ciudad destino ya no existe.`);
      else if (unidad.section.city.name !== c.antes) omitidos.push(`${c.numeroEconomico}: cambió de ciudad después de la vista previa.`);
      else traspasos.set(unidad.id, { destinoId: destino.id });
      continue;
    }

    if (c.tipo === "texto") {
      const columna = columnasDeTextoDeApartado(slug).find((col) => col.campo === c.campo);
      if (!columna) {
        omitidos.push(`${c.numeroEconomico}: «${c.etiqueta}» no aplica a este tipo de unidad.`);
        continue;
      }
      if (textoActual(unidad, columna) !== c.antes) {
        omitidos.push(`${c.numeroEconomico}, ${columna.encabezado}: cambió en el sistema después de la vista previa.`);
        continue;
      }
      const leido = c.despues === null ? ({ tipo: "borrar" } as const) : leerTexto(c.despues, columna);
      if (leido.tipo === "error" || leido.tipo === "vacio" || (leido.tipo === "borrar" && columna.requerido)) {
        omitidos.push(`${c.numeroEconomico}, ${columna.encabezado}: valor no válido.`);
        continue;
      }
      const nuevo = leido.tipo === "borrar" ? null : leido.texto;
      const destino = columna.tabla === "unidad" ? datosUnidad : datosFicha;
      destino.set(unidad.id, { ...(destino.get(unidad.id) ?? {}), [columna.campo]: nuevo });
      anotar(unidad.id, `${columna.encabezado}: ${c.antes ?? "vacío"} → ${nuevo ?? "borrado"}`);
      continue;
    }

    const columna = columnasDeApartado(slug).find((col) => col.campo === c.campo);
    if (!columna) {
      omitidos.push(`${c.numeroEconomico}: «${c.etiqueta}» no aplica a este tipo de unidad.`);
      continue;
    }
    const actual = (unidad.technicalSheet?.[columna.campo] as Date | null | undefined) ?? null;
    if ((actual?.toISOString() ?? null) !== c.antes) {
      omitidos.push(`${c.numeroEconomico}, ${columna.encabezado}: cambió en el sistema después de la vista previa.`);
      continue;
    }
    const nueva = c.despues === null ? null : new Date(c.despues);
    if (nueva && Number.isNaN(nueva.getTime())) {
      omitidos.push(`${c.numeroEconomico}, ${columna.encabezado}: fecha inválida.`);
      continue;
    }
    datosFicha.set(unidad.id, { ...(datosFicha.get(unidad.id) ?? {}), [columna.campo]: nueva });
    anotar(unidad.id, `${columna.encabezado}: ${textoFecha(actual) || "vacío"} → ${textoFecha(nueva) || "borrada"}`);
  }

  let aplicados = 0;
  const ciudadesTocadas = new Set<string>();
  for (const vehicleId of resumen.keys()) {
    const unidad = unidades.get(vehicleId)!;
    const deUnidad = datosUnidad.get(vehicleId);
    const deFicha = datosFicha.get(vehicleId);
    if (deUnidad) {
      // sucursal no admite null en la base (requerido: nunca llega null aquí).
      await prisma.vehicleRecord.update({ where: { id: vehicleId }, data: deUnidad as Record<string, string> });
      aplicados += Object.keys(deUnidad).length;
    }
    if (deFicha) {
      await prisma.vehicleTechnicalSheet.upsert({
        where: { vehicleRecordId: vehicleId },
        update: deFicha,
        create: { vehicleRecordId: vehicleId, ...deFicha },
      });
      aplicados += Object.keys(deFicha).length;
    }
    ciudadesTocadas.add(unidad.section.city.slug);
    await logActivity({
      user,
      accion: "EDITAR",
      entidad: "Ficha técnica (datos desde Excel)",
      resumen: unidad.numeroEconomico,
      detalle: resumen.get(vehicleId)!.join(" · "),
      citySlug: unidad.section.city.slug,
    });
  }

  // Los traspasos al final: los datos de arriba se guardan con la unidad
  // todavía en su ciudad. Cada uno con la misma lógica que el botón de la ficha.
  let movidas = 0;
  const yaMovidas = new Set<string>();
  for (const [vehicleId, { destinoId }] of traspasos) {
    if (yaMovidas.has(vehicleId)) continue;
    const unidad = unidades.get(vehicleId)!;
    const resultado = await trasladarUnidad({
      vehicleId,
      destinoCityId: destinoId,
      motivo: "Carga de datos desde Excel",
      userId: user.userId,
      username: user.username,
    });
    if ("error" in resultado) {
      omitidos.push(`${unidad.numeroEconomico}, ${COL_CIUDAD}: ${resultado.error}`);
      continue;
    }
    for (const m of resultado.movidas) yaMovidas.add(m.id);
    movidas += resultado.movidas.length;
    ciudadesTocadas.add(resultado.origen.slug).add(resultado.destino.slug);
    const nombres = resultado.movidas.map((m) => m.numeroEconomico);
    await logActivity({
      user,
      accion: "EDITAR",
      entidad: "Traspaso de unidad",
      resumen:
        nombres.length > 1
          ? `${nombres.join(" y ")} pasaron de ${resultado.origen.nombre} a ${resultado.destino.nombre}`
          : `${nombres[0]} pasó de ${resultado.origen.nombre} a ${resultado.destino.nombre}`,
      detalle: "Carga de datos desde Excel",
      citySlug: resultado.origen.slug,
    });
  }

  return { aplicados, unidades: resumen.size, traspasos: movidas, omitidos, ciudadesTocadas: [...ciudadesTocadas] };
}
