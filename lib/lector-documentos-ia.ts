import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import { TIPOS_LOTE, tipoLoteLabel, type ItemLote } from "./lote-documentos";

// Lee un PDF escaneado con varios documentos juntos y dice qué páginas son
// de qué documento, de qué unidad y qué datos trae (ver LoteDocumentos).
// Usa la API de Claude: necesita ANTHROPIC_API_KEY en el .env del servidor y
// salida a internet hacia api.anthropic.com. Lo que devuelve es una
// PROPUESTA: nada se guarda en una bitácora sin que alguien lo revise.

const MODELO = "claude-opus-5-5";

export function lectorConfigurado(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

const DESCRIPCION_TIPOS: Record<(typeof TIPOS_LOTE)[number], string> = {
  ULTRASONIDO: "medición de espesores por ultrasonido del recipiente/tanque",
  VISUAL_EXTERNA: "inspección visual externa del recipiente/tanque",
  HERMETICIDAD: "prueba de hermeticidad del recipiente/tanque",
  VISUAL_INTERNA: "inspección visual interna del recipiente/tanque",
  HIDROSTATICA: "prueba hidrostática (presión hidrostática) del recipiente/tanque",
  MANTENIMIENTO: "orden de trabajo, reporte de servicio o mantenimiento de taller (preventivo, correctivo o predictivo)",
  EXTINTOR: "instalación, cambio o recarga del extintor de la unidad",
  MANGUERAS: "cambio de la manguera de alta presión",
  POLIZA: "póliza de seguro de la unidad",
  UNIDAD: "cualquier otro documento de una unidad que no sea de los anteriores (tarjeta de circulación, permiso, factura, certificado, dictamen que no corresponda a ninguna de las pruebas anteriores, etc.)",
};

const SISTEMA = `Eres el capturista de documentos del departamento de mantenimiento y normatividad de Grupo Pagasa, empresa que distribuye y transporta gas L.P. en México (auto-tanques, semirremolques, vehículos de reparto, vehículos con tanque de carburación, estaciones de carburación y plantas de almacenamiento).

Recibes un PDF escaneado donde vienen VARIOS documentos uno tras otro (pruebas e inspecciones de tanques, dictámenes de unidades de verificación, pólizas, órdenes de mantenimiento, etc.). Tu trabajo:

1. Separar el PDF en documentos: cada documento ocupa un rango continuo de páginas (contando desde 1). Un documento puede tener varias páginas (anexos, hojas de mediciones, fotografías, el dictamen y su informe). Las páginas en blanco, portadas de separación o que no son de ninguna unidad van en "paginasSinUso".
2. Clasificar cada documento con uno de estos tipos:
${TIPOS_LOTE.map((t) => `   - ${t}: ${DESCRIPCION_TIPOS[t]}`).join("\n")}
   Un dictamen emitido por una unidad de verificación sobre una de las pruebas del tanque se clasifica con el tipo de esa prueba. Si un mismo documento reporta varias pruebas para la misma unidad, sepáralo en un documento por prueba con el mismo rango de páginas.
3. Identificar la unidad con el CATÁLOGO que viene abajo, comparando número económico, placas, número de serie (VIN), número de serie del tanque, número Pemex o nombre de la estación/planta. Escribe en "unidadId" el id del catálogo SOLO si el dato del documento coincide claramente con una unidad; si no hay coincidencia o hay dos posibles, deja null y explícalo en "dudas". Nunca inventes ni adivines una unidad. En "identificador" escribe el dato tal como aparece en el documento (p. ej. "No. económico AT-12", "Serie tanque 12345").
   Si la unidad es una estación o planta con varios tanques y el documento dice de cuál tanque es, pon su id en "tanqueId"; si no, null.
4. Extraer los datos tal como vienen escritos:
   - compania: empresa o unidad de verificación que emite el documento (en pólizas, la aseguradora).
   - numero: número de dictamen, informe, prueba, inspección, orden o póliza.
   - responsable: técnico, inspector o mecánico responsable que firma.
   - fechaRealizacion: fecha en que se hizo la prueba/inspección/servicio (en extintor y manguera, la de instalación; en póliza, la de expedición).
   - fechaAnterior: fecha de la prueba o inspección anterior, si el documento la menciona.
   - fechaProxima: fecha de la próxima prueba o inspección, SOLO si viene escrita; no la calcules.
   - fechaVencimiento: vencimiento del extintor o de la póliza.
   - fechaFabricacion: fecha de fabricación de la manguera.
   - tipoMantenimiento ("Preventivo", "Correctivo" o "Predictivo"), tipoServicio (resumen corto del servicio), kilometraje (solo dígitos) y descripcion: solo en mantenimientos.
   - observaciones: resultado o dictamen (p. ej. "Cumple", "No cumple: corrosión en cabeza") cuando sea relevante.
   Todas las fechas en formato AAAA-MM-DD. En México las fechas se escriben día/mes/año (04/03/2026 es 4 de marzo de 2026): no inviertas día y mes. Si un dato no viene o no se lee con seguridad, déjalo en null y anótalo en "dudas". Es preferible dejar un campo vacío que capturar un dato equivocado: estas fechas disparan alertas de cumplimiento normativo.
5. "descripcion" del lector: una frase que diga qué es el documento (p. ej. "Dictamen de prueba de hermeticidad de la UV-045 para el auto-tanque AT-12").
6. "dudas": frases cortas en español sobre lo que no quedó claro (ilegible, unidad no encontrada, fecha borrosa, etc.). Lista vacía si todo está claro.
7. "notas": comentario general sobre el lote, o cadena vacía.

Responde únicamente con el JSON del esquema.`;

const textoONulo = { anyOf: [{ type: "string" }, { type: "null" }] };

// Esquema de la salida estructurada (output_config.format): la API garantiza
// que la respuesta lo cumple; aun así se vuelve a validar abajo con zod.
const ESQUEMA_RESPUESTA = {
  type: "object",
  additionalProperties: false,
  required: ["documentos", "paginasSinUso", "notas"],
  properties: {
    documentos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "paginaInicio",
          "paginaFin",
          "tipo",
          "descripcion",
          "unidadId",
          "tanqueId",
          "identificador",
          "compania",
          "numero",
          "responsable",
          "fechaRealizacion",
          "fechaAnterior",
          "fechaProxima",
          "fechaVencimiento",
          "fechaFabricacion",
          "tipoMantenimiento",
          "tipoServicio",
          "kilometraje",
          "descripcionServicio",
          "observaciones",
          "dudas",
        ],
        properties: {
          paginaInicio: { type: "integer" },
          paginaFin: { type: "integer" },
          tipo: { type: "string", enum: [...TIPOS_LOTE] },
          descripcion: { type: "string" },
          unidadId: textoONulo,
          tanqueId: textoONulo,
          identificador: textoONulo,
          compania: textoONulo,
          numero: textoONulo,
          responsable: textoONulo,
          fechaRealizacion: textoONulo,
          fechaAnterior: textoONulo,
          fechaProxima: textoONulo,
          fechaVencimiento: textoONulo,
          fechaFabricacion: textoONulo,
          tipoMantenimiento: { anyOf: [{ type: "string", enum: ["Preventivo", "Correctivo", "Predictivo"] }, { type: "null" }] },
          tipoServicio: textoONulo,
          kilometraje: textoONulo,
          descripcionServicio: textoONulo,
          observaciones: textoONulo,
          dudas: { type: "array", items: { type: "string" } },
        },
      },
    },
    paginasSinUso: { type: "array", items: { type: "integer" } },
    notas: { type: "string" },
  },
};

const respuestaSchema = z.object({
  documentos: z.array(
    z.object({
      paginaInicio: z.number().int(),
      paginaFin: z.number().int(),
      tipo: z.enum(TIPOS_LOTE),
      descripcion: z.string(),
      unidadId: z.string().nullable(),
      tanqueId: z.string().nullable(),
      identificador: z.string().nullable(),
      compania: z.string().nullable(),
      numero: z.string().nullable(),
      responsable: z.string().nullable(),
      fechaRealizacion: z.string().nullable(),
      fechaAnterior: z.string().nullable(),
      fechaProxima: z.string().nullable(),
      fechaVencimiento: z.string().nullable(),
      fechaFabricacion: z.string().nullable(),
      tipoMantenimiento: z.string().nullable(),
      tipoServicio: z.string().nullable(),
      kilometraje: z.string().nullable(),
      descripcionServicio: z.string().nullable(),
      observaciones: z.string().nullable(),
      dudas: z.array(z.string()),
    })
  ),
  paginasSinUso: z.array(z.number().int()),
  notas: z.string(),
});

type UnidadCatalogo = {
  id: string;
  apartado: string;
  sectionSlug: string;
  numeroEconomico: string;
  activo: boolean;
  tanques: { id: string; etiqueta: string }[];
};

// Las unidades (y estaciones/plantas) de las ciudades del lote, con los
// datos con que se pueden reconocer en un documento.
async function catalogoDeUnidades(cityIds: string[]) {
  const registros = await prisma.vehicleRecord.findMany({
    where: { section: { cityId: { in: cityIds } } },
    select: {
      id: true,
      numeroEconomico: true,
      placas: true,
      activo: true,
      section: { select: { name: true, slug: true, city: { select: { name: true } } } },
      technicalSheet: { select: { serie: true, numeroSerieTanque: true, numeroPemex: true } },
      stationTankTechnicalSheets: { select: { id: true, etiqueta: true, numeroSerie: true }, orderBy: { etiqueta: "asc" } },
    },
    orderBy: [{ section: { name: "asc" } }, { numeroEconomico: "asc" }],
  });

  const unidades: UnidadCatalogo[] = registros.map((r) => ({
    id: r.id,
    apartado: r.section.name,
    sectionSlug: r.section.slug,
    numeroEconomico: r.numeroEconomico,
    activo: r.activo,
    tanques: r.stationTankTechnicalSheets.map((t) => ({ id: t.id, etiqueta: t.etiqueta })),
  }));

  const variasCiudades = cityIds.length > 1;
  const lineas = registros.map((r) => {
    const datos = [
      `id=${r.id}`,
      variasCiudades ? `ciudad=${r.section.city.name}` : null,
      `apartado=${r.section.name}`,
      `numeroEconomico/nombre=${r.numeroEconomico}`,
      r.placas ? `placas=${r.placas}` : null,
      r.technicalSheet?.serie ? `serieVIN=${r.technicalSheet.serie}` : null,
      r.technicalSheet?.numeroSerieTanque ? `serieTanque=${r.technicalSheet.numeroSerieTanque}` : null,
      r.technicalSheet?.numeroPemex ? `numeroPemex=${r.technicalSheet.numeroPemex}` : null,
      ...r.stationTankTechnicalSheets.map(
        (t) => `tanque[${t.etiqueta}]: tanqueId=${t.id}${t.numeroSerie ? ` serie=${t.numeroSerie}` : ""}`
      ),
      r.activo ? null : "(dada de baja)",
    ];
    return datos.filter(Boolean).join(" | ");
  });

  return { unidades, texto: lineas.join("\n") };
}

const fechaValida = (valor: string | null): string | null =>
  valor && /^\d{4}-\d{2}-\d{2}$/.test(valor) && !Number.isNaN(new Date(valor).getTime()) ? valor : null;

export type ResultadoLectura = {
  items: ItemLote[];
  notas: string | null;
  tokensEntrada: number;
  tokensSalida: number;
};

export async function leerLoteConIA(pdf: Buffer, paginas: number, cityIds: string[]): Promise<ResultadoLectura> {
  const { unidades, texto } = await catalogoDeUnidades(cityIds);
  const client = new Anthropic();

  // Un lote grande tarda: con streaming no se corta por tiempo de espera
  // mientras la respuesta sigue llegando.
  const stream = client.beta.messages.stream({
    model: MODELO,
    max_tokens: 64000,
    // Si el modelo rechaza la solicitud por sus filtros de seguridad (un
    // falso positivo, con documentos así es raro), la API la reintenta sola
    // con el modelo de respaldo que corresponda.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: {
      // Leer escaneos y cruzarlos con el catálogo pide cuidado: aquí un
      // error termina en una fecha de cumplimiento equivocada.
      effort: "high",
      format: { type: "json_schema", schema: ESQUEMA_RESPUESTA },
    },
    system: SISTEMA,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") } },
          {
            type: "text",
            text: `El PDF tiene ${paginas} páginas.\n\nCATÁLOGO DE UNIDADES (una por línea):\n${texto || "(sin unidades registradas)"}`,
          },
        ],
      },
    ],
  });
  const mensaje = await stream.finalMessage();

  if (mensaje.stop_reason === "refusal") {
    throw new Error("La IA no quiso procesar este documento. Divídelo a mano desde la revisión.");
  }
  if (mensaje.stop_reason === "max_tokens") {
    throw new Error("El lote es demasiado grande para leerlo de una vez. Súbelo en partes más chicas.");
  }
  const bloque = mensaje.content.find((b) => b.type === "text");
  if (!bloque || bloque.type !== "text") throw new Error("La IA no devolvió resultado.");

  const parsed = respuestaSchema.safeParse(JSON.parse(bloque.text));
  if (!parsed.success) throw new Error("La respuesta de la IA no tiene el formato esperado.");

  const porId = new Map(unidades.map((u) => [u.id, u]));
  const items: ItemLote[] = parsed.data.documentos.map((d) => {
    const dudas = [...d.dudas];
    // Lo que diga el modelo se acota a lo que de verdad existe: páginas del
    // escaneo y unidades/tanques del catálogo.
    let paginaInicio = Math.min(Math.max(1, d.paginaInicio), paginas);
    let paginaFin = Math.min(Math.max(1, d.paginaFin), paginas);
    if (paginaFin < paginaInicio) [paginaInicio, paginaFin] = [paginaFin, paginaInicio];
    if (paginaInicio !== d.paginaInicio || paginaFin !== d.paginaFin) dudas.push("Revisa el rango de páginas.");

    const unidad = d.unidadId ? porId.get(d.unidadId) : undefined;
    if (d.unidadId && !unidad) dudas.push("La unidad que propuso la IA no está en el catálogo.");
    const tanque = unidad && d.tanqueId ? unidad.tanques.find((t) => t.id === d.tanqueId) : undefined;

    const fechas = {
      fechaRealizacion: fechaValida(d.fechaRealizacion),
      fechaAnterior: fechaValida(d.fechaAnterior),
      fechaProxima: fechaValida(d.fechaProxima),
      fechaVencimiento: fechaValida(d.fechaVencimiento),
      fechaFabricacion: fechaValida(d.fechaFabricacion),
    };
    for (const [campo, valor] of Object.entries(fechas)) {
      if (!valor && d[campo as keyof typeof fechas]) dudas.push(`Fecha no reconocida (${campo}): "${d[campo as keyof typeof fechas]}".`);
    }

    return {
      id: randomUUID(),
      origen: "IA",
      paginaInicio,
      paginaFin,
      tipo: d.tipo,
      descripcionLector: d.descripcion || tipoLoteLabel[d.tipo],
      vehicleId: unidad?.id ?? null,
      tanqueId: tanque?.id ?? null,
      identificador: d.identificador,
      compania: d.compania,
      numero: d.numero,
      responsable: d.responsable,
      ...fechas,
      calidad: null,
      tipoMantenimiento: d.tipoMantenimiento,
      tipoServicio: d.tipoServicio,
      kilometraje: d.kilometraje?.replace(/\D/g, "") || null,
      // Un documento de mantenimiento que llega escaneado casi siempre es de
      // un trabajo ya hecho; quien revisa lo puede cambiar.
      estatus: d.tipo === "MANTENIMIENTO" ? "TERMINADO" : null,
      descripcion: d.tipo === "UNIDAD" ? d.descripcion : d.descripcionServicio,
      observaciones: d.observaciones,
      dudas,
      estado: "PENDIENTE",
      mensaje: null,
      resueltoPor: null,
      resueltoEl: null,
    };
  });

  const sinUso = parsed.data.paginasSinUso.filter((p) => p >= 1 && p <= paginas);
  const notas = [parsed.data.notas.trim(), sinUso.length ? `Páginas sin documento: ${sinUso.join(", ")}.` : ""]
    .filter(Boolean)
    .join(" ");

  return {
    items,
    notas: notas || null,
    tokensEntrada:
      mensaje.usage.input_tokens + (mensaje.usage.cache_creation_input_tokens ?? 0) + (mensaje.usage.cache_read_input_tokens ?? 0),
    tokensSalida: mensaje.usage.output_tokens,
  };
}
