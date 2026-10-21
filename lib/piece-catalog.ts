import { z } from "zod";
import { ESTACION_LIKE_SECTION_SLUGS } from "./estacion-sections";
import { VALVULAS_TANQUE_CARGA, VALVULA_MAXIMO_LLENADO_85 } from "./ficha-campos";

// Catálogo de piezas para la Bitácora de mantenimiento de unidades: se
// selecciona primero la categoría y después la pieza (ver
// components/admin/CreateMaintenanceLogForm.tsx). "Otro" no tiene lista fija:
// se escribe la pieza a mano. El usuario pidió dejarlo así para poder seguir
// agregando piezas a futuro sin tocar el formulario.
//
// El mantenimiento de las unidades es de INGENIERÍA DE GAS, no de mecánica
// automotriz: a petición del usuario se quitaron por completo las categorías
// de motor, transmisión, frenos, suspensión, etc. (ver
// CATEGORIAS_MECANICAS_RETIRADAS abajo). Los registros viejos que las usan se
// siguen viendo igual en el historial y en las gráficas: la categoría se
// guarda como texto en cada registro.
export const PIECE_CATALOG: Record<string, string[]> = {
  // --- Tanque de carga: Auto-Tanques y Semirremolques (ver
  // getPieceCategories). Antes todo esto era una sola categoría "Tanque";
  // se separó por sistema, conservando los mismos nombres de pieza.
  "Recipiente (tanque de carga)": [
    "Registro pasa hombre",
    "Empaque del registro pasa hombre",
    "Conchas",
    "Placa de datos del recipiente",
    "Soportes y anclaje del recipiente",
    "Amortiguador de madera",
    "Pintura del recipiente",
  ],
  // Las mismas válvulas (y nombres) de la ficha técnica del tanque de carga
  // (lib/ficha-campos.ts). Ojo: el nombre de la categoría NO puede ser
  // "Válvulas" a secas, que es la de carburación y dispara la actualización
  // sola de la ficha (lib/valve-piece-sync.ts). Para el tanque de carga, el
  // cambio de una válvula se registra en "Cambio de válvulas", que es el que
  // mueve la alerta (ver el aviso en CreateMaintenanceLogForm).
  "Válvulas del tanque de carga": [...VALVULAS_TANQUE_CARGA, VALVULA_MAXIMO_LLENADO_85].map((v) => v.etiqueta),
  "Instrumentos de medición": [
    "Medidor",
    "Medidor Neptuno",
    "Registro electrónico inteligente (Display)",
    "Magnatel (flotador de gas)",
    "Manómetro",
    "Manómetro bomba",
    "Termómetro",
  ],
  "Sistema de trasiego": [
    "Bomba",
    "Toma de fuerza",
    "Motor de carrete",
    "Carrete",
    "Manguera de descarga",
    "Acoplador de líquido",
    "Codos giratorios (coplee rotatorio)",
    "Válvula de diferencial",
    "Válvula solenoide",
    "Válvula de control",
    "Actuador",
    "Trampa de vapor",
    "Filtro de gas",
  ],
  "Tubería y conexiones de gas": ["Bridas", "Empaques", "Codo", "Tubería \"T\"", "Tubería flexible"],

  // --- Vehículo de reparto: transporta cilindros.
  "Plataforma y sujeción de cilindros": [
    "Jaula o redilas",
    "Cadenas o bandas de sujeción de cilindros",
    "Piso de la plataforma",
    "Topes y protecciones de cilindros",
  ],

  // --- Todas las unidades (incluidas utilitarias y tractocamiones, que no
  // llevan sistema de gas propio).
  "Seguridad e identificación": [
    "Extintor",
    "Letreros y rombos de identificación",
    "Cinta estática (Tierra)",
    "Conos y señalamientos de seguridad",
  ],
  // Solo Vehículo con tanque de carburación (ver getPieceCategories): las
  // únicas 4 válvulas de su sistema de gas LP para el motor (no las 9 del
  // tanque de carga de Auto-Tanques, ver lib/valve-alerts.ts). El nombre
  // entre paréntesis es como se conoce cada una en campo; el registro de
  // esta misma sección de la ficha técnica usa el nombre "oficial" (ver
  // VALVULA_PIEZA_A_CAMPO en lib/valve-piece-sync.ts: cuando se reemplaza
  // una de estas 4 en un mantenimiento normal, su fecha de fabricación se
  // actualiza sola ahí).
  Válvulas: [
    "Válvula de llenado (doble check)",
    "Válvula de máximo llenado 90%",
    "Válvula de servicio",
    "Válvula de alivio (seguridad)",
  ],
  // Solo Vehículo con tanque de carburación: el resto del kit de conversión
  // a gas LP para el motor (distinto de las válvulas de arriba). "Mangueras
  // de alta presión" también dispara la actualización sola de la ficha
  // técnica cuando se reemplaza aquí (ver lib/hose-piece-sync.ts), igual que
  // las válvulas — no reemplaza al registro dedicado "Cambio de mangueras",
  // que sigue existiendo para el historial completo con documentos.
  "Sistema de carburación": [
    "Mangueras de alta presión",
    "Filtro de gas L.P.",
    "Electroválvula",
    "Evaporador",
    "Mezclador",
    "Interruptor (Switch) gas LP/Gasolina",
  ],

  // ---------------------------------------------------------------------
  // Piezas de Estaciones de carburación y Planta (ver
  // STATION_PIECE_CATEGORIES abajo). Salen del listado que lleva el equipo
  // ("Refacciones, piezas de estaciones.xlsx"). No se mezclan con las
  // categorías de vehículo: una estación es una instalación fija, no una
  // unidad, y en su mantenimiento no se registra nada de motor/frenos.
  // ---------------------------------------------------------------------
  "Equipo de despacho": [
    "Tanque",
    "Litrómetro",
    "Registro",
    "Bomba",
    "Motor",
    "Manguera",
    "Manómetro",
    "Termómetro",
    'Válvula de pérdida mínima 1"',
    'Pullaway 3/4"',
    "Extintor",
  ],
  "Válvulas de estación": [
    "Válvula de exceso de flujo",
    "Válvula de no retroceso",
    "Válvula de seguridad",
    "Válvula check lock",
    "Válvula de llenado",
    "Válvula de servicio",
    "Válvula de relevo hidrostático",
    'Válvula de esfera de 3/4"',
    'Válvula de esfera de 1"',
    'Válvula de esfera de 1 1/4"',
    'Válvula globo de 3/4"',
    'Válvula globo de 1 1/4"',
    'Válvula solenoide de 3/4" 120 V',
    'Bay pass de 3/4"',
  ],
  "Tubería y conexiones": [
    'Tubería de 1"',
    'Tubería de 3/4"',
    'Tubería eléctrica de 3/4"',
    'Codo de 90° de 3/4"',
    'Codo de 90° de 1"',
    'Codo de 90° de 1 1/4"',
    'Codo de 45° de 3/4"',
    'Tuerca unión de 3/4"',
    'Tuerca unión de 1"',
    "Tuerca unión",
    "Niple de 3/4 x 6",
    "Niple de 3/4 x 4",
    "Niple de 3/4 x 3",
    "Niple de 6 x 1",
    "Niple de 6 x 1 1/4",
    "Niple flexible de 40 cm",
    'Cople de 1 1/4"',
    "Reducción bushing de 3/4 a 1/2",
    "Reducción bushing de 1 a 3/4",
    "Reducción bushing de 1 1/4 a 1/2",
    'Reducción bushing de 1 1/4"',
    'Tee de 3/4"',
    'Tee de 1"',
    'Tee de 1 1/4"',
    'Filtro Sarco de 1 1/4"',
  ],
  "Electrónica y registro (UDS)": [
    "Estructura de UDS micro",
    "Tarjeta madre",
    "Tarjeta fuente",
    "Tarjeta de conexiones",
    "Display 20 x 40 (chico)",
    "Display 40 x 40 (grande)",
    "Kit de comunicación",
    "Fuente de 9 volts",
    "Fuente de 24 volts",
    "Sensor óptico",
    "Teclado de uso rudo",
    "Lámpara EVA",
    "Radio de frecuencia",
    "Regulador Isotel",
    "Impresora de rollo",
    "Pictel completo",
  ],
  "Instalación eléctrica": [
    'Caja eléctrica GAU de 3/4"',
    "Cable de tierra con pinza",
    "Caja de controles de térmicos",
    "Cableado eléctrico",
    "Cables eléctricos",
    "Lámpara de iluminación",
  ],
  "Obra e instalaciones": [
    "Base para tanque de 5000 lts",
    "Escalera metálica",
    "Estructura de isleta con techumbre",
    "Tinaco con su bomba",
    "Lavamanos y accesorios",
    "Sanitario y accesorios",
    "Puerta de aluminio del baño",
    "Puerta de aluminio de oficina",
    "Ventana con cristales",
    "Escritorio",
    "Dispensador de agua",
    "Caja fuerte",
    "Alarma",
    "Puerta de malla ciclónica en zona de almacenamiento",
  ],
};

// "Otro" siempre va al final y no tiene lista fija propia — pero si ya se
// aprendieron piezas de tanto escribirlas a mano (ver lib/learned-pieces.ts),
// esas sí se ofrecen como opciones ahí, con una opción para seguir
// escribiendo libre lo que todavía no se haya aprendido.
export const PIECE_CATEGORY_OTRO = "Otro";

const TANQUE_CARGA_CATEGORIES = [
  "Recipiente (tanque de carga)",
  "Válvulas del tanque de carga",
  "Instrumentos de medición",
  "Sistema de trasiego",
  "Tubería y conexiones de gas",
];
const REPARTO_CATEGORIES = ["Plataforma y sujeción de cilindros"];
const CARBURACION_CATEGORIES = ["Válvulas", "Sistema de carburación"];
const SEGURIDAD_CATEGORY = "Seguridad e identificación";

// Categorías propias de una Estación de carburación / Planta: nunca se
// ofrecen al capturar el mantenimiento de un vehículo, ni al revés.
export const STATION_PIECE_CATEGORIES = [
  "Equipo de despacho",
  "Válvulas de estación",
  "Tubería y conexiones",
  "Electrónica y registro (UDS)",
  "Instalación eléctrica",
  "Obra e instalaciones",
];

// Categorías mecánicas que ya no se ofrecen (el mantenimiento es de gas).
// Siguen listadas para que las piezas que un ADMIN les haya agregado desde
// /admin/piezas no reaparezcan como "categoría nueva" (ver
// lib/piece-catalog-runtime.ts).
export const CATEGORIAS_MECANICAS_RETIRADAS = [
  "Motor",
  "Transmisión",
  "Sistema de Frenos",
  "Suspensión",
  "Dirección",
  "Sistema Eléctrico",
  "Sistema de Iluminación",
  "Sistema de Combustible",
  "Sistema de Enfriamiento",
  "Sistema de Escape",
  "Aire Acondicionado",
  "Llantas y Rines",
  "Carrocería",
  "Interior",
];

// Categorías que cambiaron de nombre: las piezas agregadas desde el panel
// con el nombre viejo se ofrecen en la nueva.
export const CATEGORIAS_RENOMBRADAS: Record<string, string> = {
  Tanque: "Recipiente (tanque de carga)",
};

// Qué categorías ve cada tipo de unidad. Todo es del sistema de gas: el
// tanque de carga en Auto-Tanques y Semirremolques, la plataforma de
// cilindros en Reparto, el kit de carburación en Vehículo con tanque de
// carburación, y seguridad e identificación en todas (es lo único que
// aplica a utilitarias y tractocamiones). Una Estación/Planta ve únicamente
// sus propias categorías: es una instalación fija, no un vehículo.
export function getPieceCategories(sectionSlug?: string): string[] {
  if (sectionSlug && ESTACION_LIKE_SECTION_SLUGS.includes(sectionSlug)) {
    return [...STATION_PIECE_CATEGORIES, PIECE_CATEGORY_OTRO];
  }
  if (sectionSlug === "vehiculo-con-tanque-de-carburacion") {
    return [...CARBURACION_CATEGORIES, SEGURIDAD_CATEGORY, PIECE_CATEGORY_OTRO];
  }
  // Semirremolque (Transportadora Kino) lleva el mismo tanque de carga.
  if (sectionSlug === "auto-tanques" || sectionSlug === "semirremolques") {
    return [...TANQUE_CARGA_CATEGORIES, SEGURIDAD_CATEGORY, PIECE_CATEGORY_OTRO];
  }
  if (sectionSlug === "vehiculo-de-reparto") {
    return [...REPARTO_CATEGORIES, SEGURIDAD_CATEGORY, PIECE_CATEGORY_OTRO];
  }
  return [SEGURIDAD_CATEGORY, PIECE_CATEGORY_OTRO];
}

// Para el catálogo del formulario de órdenes (ver
// components/admin/CreatePieceOrderForm.tsx): ahí no se está parado en un
// apartado concreto, así que en vez de filtrar por sección se elige primero
// para qué es la pieza y el catálogo se acota a ese grupo. Sin esto habría
// que buscar entre todas las categorías juntas, que es justo lo que se
// pidió evitar.
export const PIECE_GROUPS = ["Unidades", "Estaciones de carburación"] as const;
export type PieceGroup = (typeof PIECE_GROUPS)[number];

// Valor centinela del selector de categoría en /admin/piezas: significa "no
// es ninguna de las de la lista, voy a escribir una nueva". Vive aquí y no
// en actions/piece-catalog-actions.ts porque ese archivo es "use server" y
// ahí solo se pueden exportar funciones async.
export const CATEGORIA_NUEVA = "__NUEVA__";

export function getPieceCategoriesForGroup(grupo: PieceGroup): string[] {
  if (grupo === "Estaciones de carburación") return [...STATION_PIECE_CATEGORIES];
  return Object.keys(PIECE_CATALOG).filter(
    (categoria) => !STATION_PIECE_CATEGORIES.includes(categoria)
  );
}

// Todos los nombres de pieza ya conocidos por el catálogo fijo, sin importar
// categoría (ver lib/learned-pieces.ts: para no volver a "aprender" algo que
// ya está aquí).
export function getAllStaticPieceNames(): string[] {
  return Object.values(PIECE_CATALOG).flat();
}

export const accionPiezaSchema = z.enum(["Sustitución", "Reparación", "Mantenimiento preventivo"]);
export type AccionPieza = z.infer<typeof accionPiezaSchema>;
export const accionPiezaOptions = accionPiezaSchema.options;
