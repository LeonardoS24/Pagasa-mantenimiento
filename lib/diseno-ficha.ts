// Diseño de la ficha técnica por apartado: en qué orden salen los recuadros, si
// ocupan todo el ancho o la mitad y de qué color son. Lo acomoda el ADMIN en
// Editar sistema → Acomodar fichas (/admin/campos/acomodar) y lo usan la ficha
// de la unidad (vista y formulario) y su hoja impresa.
//
// Sin ruido: este archivo es puro (sin Prisma ni Node) porque también lo
// importa el formulario, que es un componente de navegador. Lo que se acomoda
// es SOLO la presentación; los campos, alertas y datos no cambian.
import { SECTION_STYLES, type SectionColorKey } from "./section-colors";

export type AnchoRecuadro = "completo" | "mitad";

export type AjusteRecuadro = {
  orden?: number;
  ancho?: AnchoRecuadro;
  color?: SectionColorKey;
};

// clave del recuadro → su ajuste. Las claves de fábrica son las de
// RECUADROS_FICHA; los recuadros propios del ADMIN usan "x:<id>".
export type DisenoFicha = Record<string, AjusteRecuadro>;

export type RecuadroDef = {
  clave: string;
  titulo: string;
  color: SectionColorKey;
  // true si el recuadro sale en la ficha de este apartado.
  aplica: (slug: string) => boolean;
};

const UNIDADES = ["auto-tanques", "vehiculo-de-reparto", "vehiculo-con-tanque-de-carburacion", "unidades-utilitarias", "tractocamiones", "semirremolques"];
const CON_PRUEBAS = ["auto-tanques", "semirremolques", "vehiculo-con-tanque-de-carburacion"];

// Apartados cuya ficha se puede acomodar (los de unidades; estaciones y planta
// usan otra ficha).
export const APARTADOS_ACOMODABLES: { slug: string; nombre: string }[] = [
  { slug: "auto-tanques", nombre: "Auto-Tanques" },
  { slug: "vehiculo-de-reparto", nombre: "Vehículo de reparto" },
  { slug: "vehiculo-con-tanque-de-carburacion", nombre: "Vehículo con tanque de carburación" },
  { slug: "unidades-utilitarias", nombre: "Unidades utilitarias" },
  { slug: "tractocamiones", nombre: "Tractocamiones" },
  { slug: "semirremolques", nombre: "Semirremolques" },
];

// En el orden en que salen hoy: sin ajustes la ficha se ve igual que siempre.
export const RECUADROS_FICHA: RecuadroDef[] = [
  { clave: "automovil", titulo: "Automóvil", color: "automovil", aplica: (s) => UNIDADES.includes(s) },
  { clave: "chofer-poliza", titulo: "Chofer y póliza", color: "automovil", aplica: (s) => UNIDADES.includes(s) },
  { clave: "tractocamion", titulo: "Datos del tractocamión", color: "automovil", aplica: (s) => s === "tractocamiones" },
  { clave: "gobernador", titulo: "Gobernador de velocidad", color: "automovil", aplica: (s) => s === "auto-tanques" || s === "tractocamiones" },
  { clave: "tanque", titulo: "Tanque", color: "tanque", aplica: (s) => UNIDADES.includes(s) && s !== "vehiculo-de-reparto" && s !== "tractocamiones" },
  { clave: "semirremolque", titulo: "Datos del semirremolque", color: "tanque", aplica: (s) => s === "semirremolques" },
  { clave: "mantenimiento", titulo: "Mantenimiento preventivo", color: "mantenimiento", aplica: (s) => UNIDADES.includes(s) && s !== "vehiculo-con-tanque-de-carburacion" },
  { clave: "extintor", titulo: "Extintor", color: "extintor", aplica: (s) => UNIDADES.includes(s) },
  { clave: "mangueras", titulo: "Mangueras", color: "mangueras", aplica: (s) => s === "vehiculo-con-tanque-de-carburacion" },
  { clave: "valvulas", titulo: "Válvulas", color: "valvulas", aplica: (s) => s === "auto-tanques" || s === "semirremolques" || s === "vehiculo-con-tanque-de-carburacion" },
  { clave: "dictamenes", titulo: "Dictámenes (vigencia de 1 año)", color: "valvulas", aplica: (s) => s !== "vehiculo-de-reparto" && s !== "unidades-utilitarias" && UNIDADES.includes(s) },
  { clave: "visual-externa", titulo: "Inspección visual externa", color: "visualExterna", aplica: (s) => CON_PRUEBAS.includes(s) },
  { clave: "hermeticidad", titulo: "Prueba de hermeticidad", color: "hermeticidad", aplica: (s) => CON_PRUEBAS.includes(s) },
  { clave: "visual-interna", titulo: "Inspección visual interna", color: "visualInterna", aplica: (s) => CON_PRUEBAS.includes(s) },
  { clave: "ultrasonido", titulo: "Ultrasonido", color: "ultrasonido", aplica: (s) => CON_PRUEBAS.includes(s) },
  { clave: "hidrostatica", titulo: "Prueba hidrostática", color: "hidrostatica", aplica: (s) => CON_PRUEBAS.includes(s) },
];

// Nombres de los colores, para el selector del editor.
export const NOMBRES_COLOR: Record<SectionColorKey, string> = {
  automovil: "Gris",
  extintor: "Rojo",
  mantenimiento: "Verde",
  tanque: "Azul cielo",
  mangueras: "Ámbar",
  valvulas: "Índigo",
  ultrasonido: "Turquesa",
  visualExterna: "Morado",
  hermeticidad: "Fucsia",
  visualInterna: "Violeta",
  hidrostatica: "Azul",
  propio: "Naranja",
  equipoMecanico: "Verde azulado",
  equipoElectrico: "Amarillo",
  equipoAuxiliar: "Rosa",
};

export const COLORES = Object.keys(NOMBRES_COLOR) as SectionColorKey[];

const ANCHOS: AnchoRecuadro[] = ["completo", "mitad"];

// Lee lo guardado en la base y se queda solo con lo válido: un texto dañado o
// un valor raro nunca debe romper la ficha.
export function leerDiseno(texto: string | null | undefined): DisenoFicha {
  if (!texto) return {};
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    return {};
  }
  if (!crudo || typeof crudo !== "object" || Array.isArray(crudo)) return {};
  const salida: DisenoFicha = {};
  for (const [clave, valor] of Object.entries(crudo as Record<string, unknown>)) {
    if (!valor || typeof valor !== "object") continue;
    const v = valor as Record<string, unknown>;
    const ajuste: AjusteRecuadro = {};
    if (typeof v.orden === "number" && Number.isFinite(v.orden)) ajuste.orden = Math.round(v.orden);
    if (typeof v.ancho === "string" && (ANCHOS as string[]).includes(v.ancho)) ajuste.ancho = v.ancho as AnchoRecuadro;
    if (typeof v.color === "string" && (COLORES as string[]).includes(v.color)) ajuste.color = v.color as SectionColorKey;
    if (Object.keys(ajuste).length > 0) salida[clave.slice(0, 80)] = ajuste;
  }
  return salida;
}

// Orden que lleva un recuadro cuando nadie lo movió: su lugar de siempre. Los
// recuadros propios (sin lugar de fábrica) salen al final, como hasta ahora.
export function ordenPorDefecto(clave: string): number {
  const i = RECUADROS_FICHA.findIndex((r) => r.clave === clave);
  return i >= 0 ? (i + 1) * 10 : 1000;
}

// Lo que se le pone al <div> de cada recuadro: clase (con su color), orden y
// ancho dentro de la cuadrícula de la ficha. La cuadrícula es de 2 columnas en
// pantalla ancha y de 1 en celular.
export function propsDeRecuadro(diseno: DisenoFicha | undefined, clave: string, colorBase: SectionColorKey) {
  const a = diseno?.[clave];
  const color = a?.color ?? colorBase;
  return {
    className: `min-w-0 rounded-md p-4 ${SECTION_STYLES[color]}`,
    style: {
      order: a?.orden ?? ordenPorDefecto(clave),
      gridColumn: a?.ancho === "mitad" ? "span 1 / span 1" : "1 / -1",
    },
    "data-recuadro": clave,
  };
}

// La cuadrícula que contiene los recuadros (vista y formulario).
export const CLASE_CUADRICULA_FICHA = "grid grid-cols-1 gap-6 md:grid-cols-2";
