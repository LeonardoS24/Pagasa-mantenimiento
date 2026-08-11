import { z } from "zod";

// Catálogo de piezas para la Bitácora de mantenimiento de unidades: se
// selecciona primero la categoría y después la pieza (ver
// components/admin/CreateMaintenanceLogForm.tsx). "Otro" no tiene lista fija:
// se escribe la pieza a mano. El usuario pidió dejarlo así para poder seguir
// agregando piezas a futuro sin tocar el formulario.
export const PIECE_CATALOG: Record<string, string[]> = {
  Motor: [
    "Aceite del motor",
    "Filtro de aceite",
    "Filtro de aire",
    "Filtro de combustible",
    "Bujías",
    "Bobinas de encendido",
    "Inyectores",
    "Banda de accesorios",
    "Banda o cadena de distribución",
    "Tensor de banda",
    "Poleas",
    "Bomba de agua",
    "Termostato",
    "Radiador",
    "Mangueras del sistema de enfriamiento",
    "Ventilador del radiador",
    "Junta de cabeza",
    "Pistones",
    "Bielas",
    "Cigüeñal",
    "Árbol de levas",
    "Válvulas",
    "Retenes",
    "Empaques",
  ],
  Transmisión: [
    "Embrague",
    "Disco de embrague",
    "Plato de presión",
    "Collarín",
    "Caja de cambios",
    "Convertidor de par",
    "Aceite de transmisión",
    "Filtro de transmisión",
    "Flechas",
    "Juntas homocinéticas",
    "Diferencial",
  ],
  "Sistema de Frenos": [
    "Balatas",
    "Zapatas",
    "Discos",
    "Tambores",
    "Mordazas (calipers)",
    "Cilindros de rueda",
    "Cilindro maestro",
    "Booster",
    "Líquido de frenos",
    "Mangueras de freno",
    "Tuberías",
    "Sensores ABS",
    "Módulo ABS",
  ],
  Suspensión: [
    "Amortiguadores",
    "Resortes",
    "Horquillas",
    "Bujes",
    "Rótulas",
    "Terminales",
    "Barra estabilizadora",
    "Bieletas",
    "Soportes",
  ],
  Dirección: [
    "Cremallera",
    "Caja de dirección",
    "Terminales de dirección",
    "Bomba hidráulica",
    "Depósito de dirección",
    "Mangueras hidráulicas",
    "Columna de dirección",
  ],
  "Sistema Eléctrico": [
    "Batería",
    "Alternador",
    "Motor de arranque",
    "Fusibles",
    "Relevadores",
    "Arnés eléctrico",
    "Interruptores",
    "Sensores",
    "ECU",
    "Módulos electrónicos",
  ],
  "Sistema de Iluminación": [
    "Faros",
    "Cuartos",
    "Luces de freno",
    "Direccionales",
    "Luz de reversa",
    "Luz interior",
    "Luz de placa",
  ],
  "Sistema de Combustible": [
    "Bomba de combustible",
    "Filtro de combustible",
    "Tanque",
    "Mangueras",
    "Regulador de presión",
    "Riel de inyectores",
    "Inyectores",
  ],
  "Sistema de Enfriamiento": [
    "Radiador",
    "Bomba de agua",
    "Termostato",
    "Depósito de anticongelante",
    "Mangueras",
    "Electroventilador",
    "Sensor de temperatura",
  ],
  "Sistema de Escape": [
    "Múltiple de escape",
    "Catalizador",
    "Resonador",
    "Silenciador",
    "Tuberías",
    "Sensores de oxígeno",
  ],
  "Aire Acondicionado": [
    "Compresor",
    "Condensador",
    "Evaporador",
    "Ventilador",
    "Filtro de cabina",
    "Válvula de expansión",
    "Mangueras",
    "Refrigerante",
  ],
  "Llantas y Rines": ["Llantas", "Rines", "Válvulas", "Birlos", "Tuercas", "Refacción"],
  Carrocería: [
    "Cofre",
    "Puertas",
    "Defensa delantera",
    "Defensa trasera",
    "Salpicaderas",
    "Cajuela",
    "Espejos",
    "Cristales",
    "Limpiaparabrisas",
  ],
  Interior: [
    "Asientos",
    "Cinturones",
    "Tablero",
    "Instrumentos",
    "Botones",
    "Elevadores eléctricos",
    "Seguros eléctricos",
    "Sistema de audio",
  ],
  // Solo Auto-Tanques (ver getPieceCategories): son las piezas del tanque de
  // carga que transporta, distintas del sistema de carburación propio del
  // motor de Vehículo con tanque de carburación (ver categorías "Válvulas" y
  // "Sistema de carburación" más abajo).
  Tanque: [
    "Motor de carrete",
    "Manómetro",
    "Termómetro",
    "Trampa de vapor",
    "Válvula de diferencial",
    "Válvula solenoide",
    "Codos giratorios (coplee rotatorio)",
    "Manómetro bomba",
    "Bomba",
    "Manguera de descarga",
    "Registro electrónico inteligente (Display)",
    "Bridas",
    "Empaques",
    "Carrete",
    "Magnatel (flotador de gas)",
    "Medidor Neptuno",
    "Actuador",
    "Válvula de control",
    "Filtro de gas",
    "Toma de fuerza",
    "Codo",
    "Tubería \"T\"",
    "Tubería flexible",
    "Medidor",
    "Conchas",
    "Acoplador de líquido",
    "Cinta estática (Tierra)",
    "Amortiguador de madera",
    // Solo una pieza más de mantenimiento del tanque de carga — no tiene
    // relación con el registro "Cambio de válvulas" (lib/valve-alerts.ts)
    // ni con su fecha de fabricación.
    "Válvula interna",
    "Registro pasa hombre",
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
    "Válvula de llenado (Doble check)",
    "Válvula de máximo llenado (purgador)",
    "Válvula de servicio (reguladora)",
    "Válvula de seguridad",
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
};

// "Otro" siempre va al final y no tiene lista fija propia — pero si ya se
// aprendieron piezas de tanto escribirlas a mano (ver lib/learned-pieces.ts),
// esas sí se ofrecen como opciones ahí, con una opción para seguir
// escribiendo libre lo que todavía no se haya aprendido.
export const PIECE_CATEGORY_OTRO = "Otro";

const TANQUE_CATEGORY = "Tanque";
const CARBURACION_CATEGORIES = ["Válvulas", "Sistema de carburación"];
const SECTION_ONLY_CATEGORIES = [TANQUE_CATEGORY, ...CARBURACION_CATEGORIES];

// "Tanque" (tanque de carga) solo en Auto-Tanques, además de las categorías
// genéricas de cualquier vehículo. Vehículo con tanque de carburación es
// distinto a propósito: solo ve "Válvulas" y "Sistema de carburación" — nada
// de las categorías genéricas (Motor, Transmisión, Frenos...), porque en el
// mantenimiento de esa unidad solo se registra lo relacionado a su sistema
// de gas LP, no el vehículo completo.
export function getPieceCategories(sectionSlug?: string): string[] {
  if (sectionSlug === "vehiculo-con-tanque-de-carburacion") {
    return [...CARBURACION_CATEGORIES, PIECE_CATEGORY_OTRO];
  }
  const base = Object.keys(PIECE_CATALOG).filter(
    (categoria) => !SECTION_ONLY_CATEGORIES.includes(categoria)
  );
  const categorias = [...base];
  if (sectionSlug === "auto-tanques") categorias.push(TANQUE_CATEGORY);
  return [...categorias, PIECE_CATEGORY_OTRO];
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
