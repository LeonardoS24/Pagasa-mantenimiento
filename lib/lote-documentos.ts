import { z } from "zod";
import { tipoDocumentoPruebaLabel } from "./test-document-tipos";
import { ESTACION_LIKE_SECTION_SLUGS } from "./estacion-sections";
import { esTanqueDeCarga } from "./kino-sections";
import {
  maintenanceTypeOptions,
  maintenanceStatusLabels,
  calidadMantenimientoLabels,
  calidadExtintorLabels,
} from "./vehicle-enums";

// Carga de documentos escaneados (ver LoteDocumentos en el schema): tipos,
// campos y reglas que comparten el lector con IA, las acciones y la pantalla
// de revisión. Sin Prisma ni nada de servidor, para que el componente de
// cliente lo pueda importar.

// Los mismos ids que "Documentos de pruebas" (lib/test-document-tipos.ts),
// sin válvulas: esas llevan su propio flujo por válvula y no se capturan
// desde aquí. "UNIDAD" es el cajón para lo que no es de ninguna bitácora
// (tarjeta de circulación, permiso, un dictamen suelto...).
export const TIPOS_LOTE = [
  "ULTRASONIDO",
  "VISUAL_EXTERNA",
  "HERMETICIDAD",
  "VISUAL_INTERNA",
  "HIDROSTATICA",
  "MANTENIMIENTO",
  "EXTINTOR",
  "MANGUERAS",
  "POLIZA",
  "UNIDAD",
] as const;
export type TipoLote = (typeof TIPOS_LOTE)[number];

export const tipoLoteLabel: Record<TipoLote, string> = {
  ...(Object.fromEntries(TIPOS_LOTE.map((t) => [t, tipoDocumentoPruebaLabel[t]])) as Record<TipoLote, string>),
  UNIDAD: "Otro documento de la unidad",
};

const PRUEBAS_DE_TANQUE: TipoLote[] = ["ULTRASONIDO", "VISUAL_EXTERNA", "HERMETICIDAD", "VISUAL_INTERNA", "HIDROSTATICA"];

export function esPruebaDeTanque(tipo: TipoLote): boolean {
  return PRUEBAS_DE_TANQUE.includes(tipo);
}

// En qué apartados existe cada bitácora: el mismo criterio con que la
// página de la unidad muestra u oculta cada sección
// (app/(protected)/ciudades/[citySlug]/vehiculo/[vehicleId]/page.tsx).
export function tipoAplicaEnApartado(tipo: TipoLote, sectionSlug: string): boolean {
  const esEstacionLike = ESTACION_LIKE_SECTION_SLUGS.includes(sectionSlug);
  if (esPruebaDeTanque(tipo)) {
    return esTanqueDeCarga(sectionSlug) || sectionSlug === "vehiculo-con-tanque-de-carburacion" || esEstacionLike;
  }
  if (tipo === "POLIZA") return !esEstacionLike;
  if (tipo === "MANGUERAS") return sectionSlug === "vehiculo-con-tanque-de-carburacion";
  return true;
}

// Un documento detectado dentro del lote. Se guarda como JSON en
// LoteDocumentos.documentos; las fechas van como "AAAA-MM-DD" (lo mismo que
// un <input type="date">), y cada campo es null cuando no se leyó.
export const itemLoteSchema = z.object({
  id: z.string(),
  origen: z.enum(["IA", "MANUAL"]),
  paginaInicio: z.number().int().min(1),
  paginaFin: z.number().int().min(1),
  tipo: z.enum(TIPOS_LOTE),
  // Lo que el lector dice que es (p. ej. "Dictamen de hermeticidad de la
  // UV-123"), para que quien revisa entienda por qué lo clasificó así.
  descripcionLector: z.string().nullable().default(null),
  vehicleId: z.string().nullable().default(null),
  tanqueId: z.string().nullable().default(null),
  // El dato del documento con el que se reconoció la unidad.
  identificador: z.string().nullable().default(null),
  compania: z.string().nullable().default(null),
  numero: z.string().nullable().default(null),
  responsable: z.string().nullable().default(null),
  fechaRealizacion: z.string().nullable().default(null),
  fechaAnterior: z.string().nullable().default(null),
  fechaProxima: z.string().nullable().default(null),
  fechaVencimiento: z.string().nullable().default(null),
  fechaFabricacion: z.string().nullable().default(null),
  calidad: z.string().nullable().default(null),
  tipoMantenimiento: z.string().nullable().default(null),
  tipoServicio: z.string().nullable().default(null),
  kilometraje: z.string().nullable().default(null),
  estatus: z.string().nullable().default(null),
  descripcion: z.string().nullable().default(null),
  observaciones: z.string().nullable().default(null),
  dudas: z.array(z.string()).default([]),
  estado: z.enum(["PENDIENTE", "GUARDADO", "DESCARTADO"]).default("PENDIENTE"),
  mensaje: z.string().nullable().default(null),
  resueltoPor: z.string().nullable().default(null),
  resueltoEl: z.string().nullable().default(null),
});
export type ItemLote = z.infer<typeof itemLoteSchema>;

// Lo que viene de la base nunca debe tumbar la página: un elemento que no
// cuadre con el esquema se omite en vez de lanzar.
export function leerItemsLote(json: string): ItemLote[] {
  let datos: unknown;
  try {
    datos = JSON.parse(json);
  } catch {
    return [];
  }
  if (!Array.isArray(datos)) return [];
  return datos.flatMap((d) => {
    const r = itemLoteSchema.safeParse(d);
    return r.success ? [r.data] : [];
  });
}

// Un documento recién agregado (a mano, por archivo o por la IA), con todo
// vacío salvo lo que se indique.
export function itemLoteNuevo(
  datos: Pick<ItemLote, "id" | "origen" | "paginaInicio" | "paginaFin" | "tipo"> & Partial<ItemLote>
): ItemLote {
  return itemLoteSchema.parse({
    // Un mantenimiento que llega escaneado casi siempre es de un trabajo ya
    // hecho; quien revisa lo puede cambiar.
    estatus: datos.tipo === "MANTENIMIENTO" ? "TERMINADO" : null,
    ...datos,
  });
}

// La sección de la página de la unidad donde queda cada tipo (los id de
// app/(protected)/ciudades/[citySlug]/vehiculo/[vehicleId]/page.tsx), para
// llevar directo al registro guardado: si hubo un error, ahí se borra con la
// contraseña, como cualquier otro registro.
export const anclaDeTipo: Record<TipoLote, string> = {
  ULTRASONIDO: "ultrasonido",
  VISUAL_EXTERNA: "visual-externa",
  HERMETICIDAD: "hermeticidad",
  VISUAL_INTERNA: "visual-interna",
  HIDROSTATICA: "hidrostatica",
  MANTENIMIENTO: "mantenimiento",
  EXTINTOR: "extintor",
  MANGUERAS: "mangueras",
  POLIZA: "",
  UNIDAD: "documentacion",
};

// Solo letras y números, en mayúsculas y sin acentos: "PH-10" y "ph 10"
// quedan igual ("PH10").
function claveDeNombre(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// Al subir varios PDF, la unidad de cada uno se adivina por el nombre del
// archivo ("Hermeticidad PH-10.pdf" → PH10). Se compara palabra por palabra
// (y pegando hasta 4 palabras seguidas, para "PH 10" o "Estación Norte"),
// nunca como subcadena: así "PH1" no se confunde con "PH10". Si el mismo
// número económico existe en dos apartados, se queda con el que admite ese
// tipo de documento; si sigue habiendo duda, no elige ninguna.
export function adivinarUnidadPorNombre<U extends { id: string; numeroEconomico: string; sectionSlug: string }>(
  nombreArchivo: string,
  unidades: U[],
  tipo: TipoLote
): U | null {
  const palabras = nombreArchivo
    .replace(/\.pdf$/i, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const candidatos = new Set<string>();
  for (let i = 0; i < palabras.length; i++) {
    for (let largo = 1; largo <= 4 && i + largo <= palabras.length; largo++) {
      candidatos.add(claveDeNombre(palabras.slice(i, i + largo).join("")));
    }
  }
  const coinciden = unidades.filter((u) => {
    const clave = claveDeNombre(u.numeroEconomico);
    return clave.length >= 2 && candidatos.has(clave);
  });
  if (coinciden.length <= 1) return coinciden[0] ?? null;
  const queAplican = coinciden.filter((u) => tipoAplicaEnApartado(tipo, u.sectionSlug));
  return queAplican.length === 1 ? queAplican[0] : null;
}

export type EstadoLote = "ANALIZANDO" | "POR_REVISAR" | "ERROR";

export const estadoLoteLabel: Record<string, string> = {
  ANALIZANDO: "Leyendo documentos...",
  POR_REVISAR: "Por revisar",
  ERROR: "Falló la lectura",
};

// Campos editables del documento (los de ItemLote que se capturan).
export type CampoItem =
  | "compania"
  | "numero"
  | "responsable"
  | "fechaRealizacion"
  | "fechaAnterior"
  | "fechaProxima"
  | "fechaVencimiento"
  | "fechaFabricacion"
  | "calidad"
  | "tipoMantenimiento"
  | "tipoServicio"
  | "kilometraje"
  | "estatus"
  | "descripcion"
  | "observaciones";

export type DefCampo = {
  campo: CampoItem;
  etiqueta: string;
  control: "texto" | "fecha" | "numero" | "textoLargo" | "opciones";
  opciones?: { valor: string; etiqueta: string }[];
  requerido?: boolean;
};

const opcionesDe = (labels: Record<string, string>) =>
  Object.entries(labels).map(([valor, etiqueta]) => ({ valor, etiqueta }));

const compania: DefCampo = { campo: "compania", etiqueta: "Compañía", control: "texto" };
const responsable: DefCampo = { campo: "responsable", etiqueta: "Responsable", control: "texto" };

// Qué se captura en cada tipo, con las mismas etiquetas y obligatorios que
// el formulario de la bitácora correspondiente (components/admin/Create*Form):
// lo que aquí se marca como requerido es lo que esa acción rechaza vacío.
export const CAMPOS_POR_TIPO: Record<TipoLote, DefCampo[]> = {
  ULTRASONIDO: [
    compania,
    { campo: "numero", etiqueta: "Número de ultrasonido", control: "texto" },
    responsable,
    { campo: "fechaAnterior", etiqueta: "Última fecha de ultrasonido", control: "fecha" },
    { campo: "fechaRealizacion", etiqueta: "Fecha de realización", control: "fecha", requerido: true },
  ],
  VISUAL_EXTERNA: [
    compania,
    { campo: "numero", etiqueta: "Número de inspección", control: "texto" },
    responsable,
    { campo: "fechaAnterior", etiqueta: "Fecha de la última inspección", control: "fecha" },
    { campo: "fechaRealizacion", etiqueta: "Fecha de realización", control: "fecha", requerido: true },
    { campo: "fechaProxima", etiqueta: "Fecha de la próxima inspección", control: "fecha", requerido: true },
  ],
  HERMETICIDAD: [
    compania,
    { campo: "numero", etiqueta: "Número de prueba", control: "texto" },
    responsable,
    { campo: "fechaAnterior", etiqueta: "Fecha de la última prueba", control: "fecha" },
    { campo: "fechaRealizacion", etiqueta: "Fecha de realización", control: "fecha", requerido: true },
    { campo: "fechaProxima", etiqueta: "Fecha de la próxima prueba", control: "fecha", requerido: true },
  ],
  VISUAL_INTERNA: [
    compania,
    { campo: "numero", etiqueta: "Número de inspección", control: "texto" },
    responsable,
    { campo: "fechaAnterior", etiqueta: "Fecha de la última inspección", control: "fecha" },
    { campo: "fechaRealizacion", etiqueta: "Fecha de realización", control: "fecha", requerido: true },
  ],
  HIDROSTATICA: [
    compania,
    { campo: "numero", etiqueta: "Número de prueba", control: "texto" },
    responsable,
    { campo: "fechaAnterior", etiqueta: "Fecha de la última prueba", control: "fecha" },
    { campo: "fechaRealizacion", etiqueta: "Fecha de realización", control: "fecha", requerido: true },
  ],
  MANTENIMIENTO: [
    {
      campo: "tipoMantenimiento",
      etiqueta: "Tipo de mantenimiento",
      control: "opciones",
      opciones: maintenanceTypeOptions.map((t) => ({ valor: t, etiqueta: t })),
      requerido: true,
    },
    { campo: "tipoServicio", etiqueta: "Tipo de servicio", control: "texto", requerido: true },
    {
      campo: "calidad",
      etiqueta: "Calidad de la unidad",
      control: "opciones",
      opciones: opcionesDe(calidadMantenimientoLabels),
      requerido: true,
    },
    { campo: "fechaRealizacion", etiqueta: "Fecha", control: "fecha", requerido: true },
    // Obligatorio solo en vehículos (una estación no tiene odómetro); eso
    // lo revisa createMaintenanceLog.
    { campo: "kilometraje", etiqueta: "Kilometraje", control: "numero" },
    { campo: "responsable", etiqueta: "Responsable del trabajo", control: "texto" },
    {
      campo: "estatus",
      etiqueta: "Estatus",
      control: "opciones",
      opciones: opcionesDe(maintenanceStatusLabels),
      requerido: true,
    },
    { campo: "descripcion", etiqueta: "Descripción", control: "textoLargo" },
    { campo: "observaciones", etiqueta: "Observación", control: "textoLargo" },
  ],
  EXTINTOR: [
    responsable,
    { campo: "fechaRealizacion", etiqueta: "Fecha de instalación", control: "fecha", requerido: true },
    { campo: "fechaVencimiento", etiqueta: "Fecha de vencimiento", control: "fecha", requerido: true },
    {
      campo: "calidad",
      etiqueta: "Calidad del extintor",
      control: "opciones",
      opciones: opcionesDe(calidadExtintorLabels),
      requerido: true,
    },
  ],
  MANGUERAS: [
    responsable,
    { campo: "fechaRealizacion", etiqueta: "Fecha de instalación", control: "fecha", requerido: true },
    { campo: "fechaFabricacion", etiqueta: "Fecha de fabricación de la manguera", control: "fecha", requerido: true },
  ],
  POLIZA: [
    { campo: "compania", etiqueta: "Aseguradora", control: "texto" },
    { campo: "numero", etiqueta: "Número de póliza", control: "texto" },
    { campo: "fechaRealizacion", etiqueta: "Fecha en que se realizó", control: "fecha", requerido: true },
    { campo: "fechaVencimiento", etiqueta: "Fecha de vencimiento", control: "fecha", requerido: true },
    { campo: "observaciones", etiqueta: "Observaciones", control: "textoLargo" },
  ],
  UNIDAD: [{ campo: "descripcion", etiqueta: "Nombre del documento", control: "texto", requerido: true }],
};

export const MAX_LOTE_BYTES = 20 * 1024 * 1024; // mismo tope que serverActions.bodySizeLimit

// "Ultrasonido AT-12 2026-03-04.pdf": el nombre con que queda cada parte en
// su bitácora, para reconocerla al descargarla.
export function nombreArchivoItem(item: ItemLote, numeroEconomico: string): string {
  const base =
    item.tipo === "UNIDAD" && item.descripcion?.trim()
      ? item.descripcion.trim()
      : [tipoLoteLabel[item.tipo], numeroEconomico, item.fechaRealizacion].filter(Boolean).join(" ");
  const limpio = base.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);
  return `${limpio || "Documento"}.pdf`;
}
