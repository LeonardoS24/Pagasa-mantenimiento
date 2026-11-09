import { APARTADOS_CON_PLANTILLA, columnasDeApartado } from "./carga-fechas";
import { RECUADROS_FICHA } from "./diseno-ficha";

// Alertas que el ADMIN configura sin tocar el código (Administración →
// Alertas → Configurar alertas, /admin/alertas/configurar):
//
// 1. Las de FÁBRICA (ultrasonido, válvulas, póliza...): se les cambia el
//    nombre o se quitan; quitar una la saca de Inicio, de la portada de la
//    ciudad, del calendario, del tablero, de los correos y de los avisos. Los
//    datos no se tocan y se puede volver a poner.
// 2. Las AGREGADAS (tabla AlertaPropia): toman una fecha y avisan cuando se
//    acerca su vencimiento. La fecha sale de un campo de la ficha (de
//    fábrica), de un campo que agregó el ADMIN (tipo fecha) o del último
//    registro de una bitácora (mantenimiento, extintor, pruebas...).
//
// Este archivo no usa Prisma: lo importan también los formularios del panel.
// Lo que lee la base está en lib/alertas-servidor.ts.

export type TipoAlertaFabrica =
  | "ultrasonido"
  | "visualExterna"
  | "hermeticidad"
  | "visualInterna"
  | "hidrostatica"
  | "extintor"
  | "mantenimiento"
  | "valvulas"
  | "valvulasEstacion"
  | "instrumentosPlanta"
  | "mangueras"
  | "dictamen"
  | "poliza";

// Nombre = título del cuadro de la alerta (el que sale en Inicio).
export const ALERTAS_DE_FABRICA: { tipo: TipoAlertaFabrica; nombre: string; descripcion: string }[] = [
  { tipo: "ultrasonido", nombre: "Alertas de ultrasonido de tanque", descripcion: "Próximo ultrasonido de la ficha o del último registro." },
  { tipo: "visualExterna", nombre: "Alertas de inspección visual externa de tanque", descripcion: "Próxima inspección visual externa." },
  { tipo: "hermeticidad", nombre: "Alertas de prueba de hermeticidad de tanque", descripcion: "Próxima prueba de hermeticidad." },
  { tipo: "visualInterna", nombre: "Alertas de inspección visual interna de tanque", descripcion: "Próxima inspección visual interna." },
  { tipo: "hidrostatica", nombre: "Alertas de prueba hidrostática de tanque", descripcion: "Próxima prueba hidrostática." },
  { tipo: "extintor", nombre: "Alertas de extintor", descripcion: "Extintor con calidad «mala» (no lleva fecha)." },
  { tipo: "mantenimiento", nombre: "Alertas de mantenimiento preventivo", descripcion: "Próximo mantenimiento preventivo." },
  { tipo: "valvulas", nombre: "Alertas de cambio de válvulas", descripcion: "Válvulas de las unidades (tanque de carga y carburación), con el plazo de Normas y plazos." },
  { tipo: "valvulasEstacion", nombre: "Alertas de cambio de válvulas — Estaciones", descripcion: "Juego de válvulas del tanque de cada estación." },
  { tipo: "instrumentosPlanta", nombre: "Alertas de válvulas e instrumentos — Planta", descripcion: "Cada instrumento del tanque de la planta." },
  { tipo: "mangueras", nombre: "Alertas de cambio de mangueras y conectores flexibles", descripcion: "Manguera de carburación, manguera de surtir y conector flexible." },
  { tipo: "dictamen", nombre: "Alertas de vencimiento de dictámenes", descripcion: "Dictámenes anuales capturados en la ficha." },
  { tipo: "poliza", nombre: "Alertas de vencimiento de póliza de seguro", descripcion: "Última póliza registrada de cada unidad." },
];

export function esTipoDeFabrica(tipo: string): tipo is TipoAlertaFabrica {
  return ALERTAS_DE_FABRICA.some((a) => a.tipo === tipo);
}

// Apartados donde puede aplicar una alerta agregada.
export const APARTADOS_PARA_ALERTAS: { slug: string; nombre: string }[] = [
  { slug: "auto-tanques", nombre: "Auto-Tanques" },
  { slug: "vehiculo-de-reparto", nombre: "Vehículo de reparto" },
  { slug: "vehiculo-con-tanque-de-carburacion", nombre: "Vehículo con tanque de carburación" },
  { slug: "unidades-utilitarias", nombre: "Unidades utilitarias" },
  { slug: "tractocamiones", nombre: "Tractocamiones" },
  { slug: "semirremolques", nombre: "Semirremolques" },
  { slug: "estaciones-de-carburacion", nombre: "Estaciones de carburación" },
  { slug: "planta-ficha-tecnica", nombre: "Planta" },
];

export type FuenteAlerta = "FICHA" | "CAMPO" | "REGISTRO";
export type ModoAlerta = "VENCE" | "PLAZO";

// Bitácoras de la unidad de las que puede salir la fecha (la del registro
// más reciente). `ancla` es su sección en la página de la unidad.
export const REGISTROS_PARA_ALERTAS: { clave: string; nombre: string; ancla: string }[] = [
  { clave: "mantenimiento", nombre: "Bitácora de mantenimiento (fecha del último)", ancla: "#mantenimiento" },
  { clave: "extintor", nombre: "Cambio de extintor (fecha del último cambio)", ancla: "#extintor" },
  { clave: "extintorVencimiento", nombre: "Cambio de extintor (vencimiento del último)", ancla: "#extintor" },
  { clave: "mangueras", nombre: "Cambio de mangueras (instalación de la última)", ancla: "#mangueras" },
  { clave: "valvulas", nombre: "Cambio de válvulas (instalación del último juego)", ancla: "#valvulas" },
  { clave: "valvulasCorrectivo", nombre: "Mantenimiento correctivo de válvulas (último)", ancla: "#valvulas-correctivo" },
  { clave: "visualExterna", nombre: "Inspección visual externa (última realizada)", ancla: "#visual-externa" },
  { clave: "hermeticidad", nombre: "Prueba de hermeticidad (última realizada)", ancla: "#hermeticidad" },
  { clave: "visualInterna", nombre: "Inspección visual interna (última realizada)", ancla: "#visual-interna" },
  { clave: "ultrasonido", nombre: "Ultrasonido (último realizado)", ancla: "#ultrasonido" },
  { clave: "hidrostatica", nombre: "Prueba hidrostática (última realizada)", ancla: "#hidrostatica" },
  { clave: "polizaVencimiento", nombre: "Póliza de seguro (vencimiento de la última)", ancla: "#documentacion" },
  { clave: "sellos", nombre: "Sellos (instalación del último)", ancla: "#sellos" },
];

// Campos de fecha de la ficha técnica (de fábrica) que puede vigilar una
// alerta: los mismos que se cargan desde Excel, más la fabricación del tanque.
export function camposFechaDeFicha(): { campo: string; nombre: string }[] {
  const vistos = new Map<string, string>();
  vistos.set("fechaFabricacionTanque", "Tanque — fabricación");
  for (const slug of APARTADOS_CON_PLANTILLA) {
    for (const c of columnasDeApartado(slug)) {
      if (!vistos.has(c.campo)) vistos.set(c.campo, c.encabezado);
    }
  }
  return [...vistos.entries()].map(([campo, nombre]) => ({ campo, nombre }));
}

export function nombreDeFuente(
  fuente: string,
  fuenteClave: string,
  camposPropios: { id: string; etiqueta: string }[] = []
): string {
  if (fuente === "FICHA") return camposFechaDeFicha().find((c) => c.campo === fuenteClave)?.nombre ?? fuenteClave;
  if (fuente === "REGISTRO") return REGISTROS_PARA_ALERTAS.find((r) => r.clave === fuenteClave)?.nombre ?? fuenteClave;
  return camposPropios.find((c) => c.id === fuenteClave)?.etiqueta ?? "Campo agregado (ya no existe)";
}

// Lee la lista de apartados guardada como JSON; un valor raro da lista vacía.
export function leerApartados(texto: string | null | undefined): string[] {
  try {
    const v = JSON.parse(texto ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Vencimiento de una alerta agregada a partir de la fecha que vigila. Las
// fechas del sistema van a medianoche UTC.
export function vencimientoDeAlertaPropia(
  fecha: Date,
  alerta: { modo: string; plazoAnios: number; plazoMeses: number }
): Date {
  if (alerta.modo === "VENCE") return fecha;
  const totalMeses = alerta.plazoAnios * 12 + alerta.plazoMeses;
  const anio = fecha.getUTCFullYear() + Math.floor((fecha.getUTCMonth() + totalMeses) / 12);
  const mes = (fecha.getUTCMonth() + totalMeses) % 12;
  // Sin desbordar al mes siguiente (31 de enero + 1 mes = 28/29 de febrero).
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes, Math.min(fecha.getUTCDate(), ultimoDia)));
}

// Rojo a 7 días o menos (incluye vencido), amarillo dentro de los días de
// aviso de la alerta; como las de fábrica.
export function nivelDeAlertaPropia(dias: number, diasAviso: number): "red" | "yellow" | "none" {
  if (dias <= 7) return "red";
  if (dias <= Math.max(diasAviso, 7)) return "yellow";
  return "none";
}

// "AAAA-MM-DD" de un campo agregado tipo fecha → Date a medianoche UTC.
export function leerFechaDeCampo(valor: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor ?? "");
  if (!m) return null;
  const f = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(f.getTime()) ? null : f;
}

// A qué recuadro de la ficha lleva «Ver unidad» de una alerta que vigila un
// dato de fábrica de la ficha.
export function anclaDeCampoFicha(campo: string): string {
  if (/Dictamen/.test(campo)) return "#r-dictamenes";
  if (/Valvula|Manguera|Conector|Acoplamiento|Manometro/.test(campo)) return "#r-valvulas";
  if (/Ultrasonido/.test(campo)) return "#r-ultrasonido";
  if (/InspeccionVisualInterna/.test(campo)) return "#r-visual-interna";
  if (/InspeccionVisual/.test(campo)) return "#r-visual-externa";
  if (/Hermeticidad/.test(campo)) return "#r-hermeticidad";
  if (/Hidrostatica/.test(campo)) return "#r-hidrostatica";
  if (/Mantenimiento/.test(campo)) return "#r-mantenimiento";
  if (/Tanque/.test(campo)) return "#r-tanque";
  return "#ficha";
}

// A qué recuadro de la ficha lleva «Ver unidad» de una alerta que vigila un
// campo agregado: el recuadro donde vive ese campo.
export function anclaDeCampo(seccion: string): string {
  if (seccion.startsWith("x:")) return `#r-${seccion}`;
  const r = RECUADROS_FICHA.find((x) => x.seccionCampos === seccion);
  return r ? `#r-${r.clave}` : "#ficha";
}
