import { PLAZOS_BASE, type Plazos } from "./plazos";

// Catálogo de requisitos normativos que respaldan las alertas del sistema:
// qué dice la norma, de dónde sale y, donde hay alerta, el plazo en años. El
// ADMIN lo ajusta desde /admin/normas (ver RequisitoNormativoAjuste en el
// schema y lib/requisitos-runtime.ts); lo de aquí es el valor base.
//
// IMPORTANTE sobre `verificado`: significa que alguien cotejó la cita contra
// el texto oficial. Las citas que se tomaron de la tabla del área de
// normatividad y que todavía no se han cotejado salen marcadas como
// "pendiente de cotejar" para que nadie las cite como textuales sin revisar.
export type Requisito = {
  clave: string;
  nombre: string;
  // Dónde se aplica (texto libre, para mostrar).
  aplicaA: string;
  norma: string;
  numeral: string;
  // Lo que dice la norma, en una o dos frases.
  cita: string;
  // Desde cuándo se cuenta el plazo.
  cuentaDesde: string;
  // Si el plazo mueve una alerta, a qué plazo del sistema corresponde (y el
  // valor base está en PLAZOS_BASE). Sin esto, el requisito es solo de
  // referencia.
  plazoClave?: keyof Plazos;
  // Aclaración sobre cómo lo aplica el sistema (diferencias con la norma,
  // lo que todavía no tiene alerta, etc.).
  nota?: string;
  verificado: boolean;
};

export const REQUISITOS_BASE: Requisito[] = [
  {
    clave: "valvulas-tanque-carga",
    nombre: "Válvulas del tanque de carga",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-009-ASEA-2026 (Auto-Tanques) y NOM-EM-008-ASEA-2026 (Semirremolques)",
    numeral: "6.3.2 y Tabla 4 (Auto-Tanques) · Tabla 3 (Semirremolques)",
    cita: "Las válvulas de relevo de presión, exceso de flujo, no retroceso y llenado deben tener menos de 10 años desde su fabricación, o menos si lo indica el fabricante.",
    cuentaDesde: "fabricación de la válvula más antigua",
    plazoClave: "valvulasTanqueCarga",
    nota: "La norma fija los 10 años a esas 4 válvulas; la alerta lo aplica a todo el juego.",
    verificado: true,
  },
  {
    clave: "valvulas-carburacion",
    nombre: "Válvulas del tanque de carburación",
    aplicaA: "Vehículo con tanque de carburación",
    norma: "NOM-005-SESH-2010",
    numeral: "9.6.4",
    cita: "Las válvulas de llenado, servicio y seguridad se cambian cada 5 años como máximo desde su fabricación (si no traen fecha, la del recipiente).",
    cuentaDesde: "fabricación de la válvula más antigua",
    plazoClave: "valvulasCarburacion",
    verificado: true,
  },
  {
    clave: "manguera-trasiego",
    nombre: "Manguera de trasiego",
    aplicaA: "Auto-Tanques (manguera de surtir)",
    norma: "NOM-EM-009-ASEA-2026",
    numeral: "Tabla 4, inciso t)",
    cita: "Se sustituye al cumplir 5 años a partir de su fecha de fabricación.",
    cuentaDesde: "fabricación de la manguera",
    plazoClave: "mangueraTrasiego",
    nota: "La NOM-EM-008 (Semirremolques) no fija plazo para la manguera; el sistema también la alerta en Semirremolques.",
    verificado: true,
  },
  {
    clave: "manguera-carburacion",
    nombre: "Manguera de presión no regulada",
    aplicaA: "Vehículo con tanque de carburación",
    norma: "NOM-005-SESH-2010",
    numeral: "9.6.6 y 9.6.7",
    cita: "Las mangueras de presión no regulada se cambian cada 2 años desde el inicio de operación del sistema a gas (en vehículos de fábrica, lo que indique el manual; si no dice, 2 años).",
    cuentaDesde: "fabricación de la manguera",
    plazoClave: "mangueraCarburacion",
    nota: "La norma cuenta desde el inicio de operación; el sistema, desde la fecha de fabricación capturada.",
    verificado: true,
  },
  {
    clave: "valvulas-estacion",
    nombre: "Válvulas de la estación de carburación",
    aplicaA: "Estaciones de carburación",
    norma: "Criterio interno",
    numeral: "—",
    cita: "Se cambian a los 5 años de la fabricación de la válvula más antigua del tanque.",
    cuentaDesde: "fabricación de la válvula más antigua del tanque",
    plazoClave: "valvulasEstacion",
    nota: "Falta la norma que lo fija: la de estaciones de carburación (hoy se cita la NOM-003-SEDG-2004; la NOM-012-ASEA-2021 se menciona como su sustituta). No se tiene su texto.",
    verificado: false,
  },
  {
    clave: "instrumentos-planta",
    nombre: "Instrumentos y válvulas del tanque de la planta",
    aplicaA: "Planta",
    norma: "Criterio interno",
    numeral: "—",
    cita: "Cada instrumento se cambia a los 5 años de su último cambio o, si nunca se cambió, de su fabricación.",
    cuentaDesde: "último cambio o, si no hay, fabricación",
    plazoClave: "instrumentosPlanta",
    nota: "La NOM-018-ASEA-2023 no fija 5 años: 7.2.17.4 VII manda reemplazarlos según la vida útil del fabricante, y 7.2.17.1 XII fija 10 años (o la garantía menor del fabricante) para exceso de flujo, no retroceso y relevo de presión.",
    verificado: false,
  },

  // ----- Solo referencia: lo que dice la norma pero que el sistema calcula
  // de otra forma o todavía no alerta. Sin plazo editable.
  {
    clave: "mantenimiento-preventivo",
    nombre: "Mantenimiento preventivo",
    aplicaA: "Vehículos a gas",
    norma: "NOM-005-SESH-2010",
    numeral: "9.6.1 y 9.6.2",
    cita: "Mantenimiento preventivo cada 6 meses o 10,000 km, lo que ocurra primero, anotado en libro-bitácora.",
    cuentaDesde: "último mantenimiento preventivo",
    nota: "El sistema avisa por fecha (6 meses); los 10,000 km son de referencia.",
    verificado: true,
  },
  {
    clave: "dictamen-espesores",
    nombre: "Dictamen del recipiente",
    aplicaA: "Vehículos a gas con recipiente de 10 años o más",
    norma: "NOM-005-SESH-2010",
    numeral: "9.6.5",
    cita: "Si el recipiente tiene 10 años o más de fabricado, debe tener dictamen vigente que evalúe el cuerpo y las cabezas (NOM-013-SEDG-2002).",
    cuentaDesde: "fabricación del tanque; después, cada ultrasonido",
    nota: "Ya se alerta con el ultrasonido (10 años la primera vez, luego 5).",
    verificado: true,
  },
  {
    clave: "pruebas-periodicas-tanque",
    nombre: "Pruebas periódicas del tanque de carga",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-009-ASEA-2026 (Auto-Tanques) y NOM-EM-008-ASEA-2026 (Semirremolques)",
    numeral: "7.2.2.4, Tabla 3 (Auto-Tanques) · 7.4.4, Tabla 2 (Semirremolques)",
    cita: "Inspección visual externa y prueba de hermeticidad, cada año. Prueba hidrostática, cada 10 años desde la fabricación. Espesores por ultrasonido, a los 10 años y luego cada 5.",
    cuentaDesde: "fabricación del tanque",
    nota: "Diferencia: al registrar una prueba hidrostática el sistema agenda la siguiente a 5 años; la norma pide 10.",
    verificado: true,
  },
  {
    clave: "dictamen-operacion-mantenimiento",
    nombre: "Dictamen de operación y mantenimiento",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-009-ASEA-2026 (Auto-Tanques) y NOM-EM-008-ASEA-2026 (Semirremolques)",
    numeral: "7.4.1 (Auto-Tanques) · 7.7.5 (Semirremolques)",
    cita: "Se obtiene cada año, de una unidad de inspección acreditada. En Semirremolques y Tractocamiones también el dictamen anual de la NOM-068-SCT-2-2014 (7.5.3).",
    cuentaDesde: "fecha de emisión",
    nota: "Sin alerta todavía: falta un campo para la fecha del dictamen.",
    verificado: true,
  },
  {
    clave: "valvula-interna",
    nombre: "Válvula interna",
    aplicaA: "Auto-Tanques",
    norma: "NOM-EM-009-ASEA-2026",
    numeral: "Tabla 4, inciso e)",
    cita: "Sin plazo fijo: debe abrir y cerrar con su accionador y tener registro de su fecha de fabricación.",
    cuentaDesde: "—",
    nota: "Se guarda su fecha, pero no entra a la alerta.",
    verificado: true,
  },
  {
    clave: "conectores-flexibles",
    nombre: "Conectores flexibles",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-009-ASEA-2026 (Auto-Tanques) y NOM-EM-008-ASEA-2026 (Semirremolques)",
    numeral: "Tabla 4, inciso p) (Auto-Tanques) · Tabla 3 (Semirremolques)",
    cita: "Se sustituyen al cumplir 5 años a partir de su fabricación; longitud máxima de 1 m.",
    cuentaDesde: "fabricación del conector",
    nota: "Sin alerta todavía: falta un campo para su fecha.",
    verificado: true,
  },
  {
    clave: "acoplamiento-desconexion-seca",
    nombre: "Acoplamiento de llenado de desconexión seca",
    aplicaA: "Auto-Tanques que cargan en las zonas metropolitanas del Apéndice C",
    norma: "NOM-EM-009-ASEA-2026",
    numeral: "Tabla 4, inciso d)",
    cita: "Mismo criterio que la válvula de llenado: menos de 10 años desde su fabricación, o menos si lo indica el fabricante.",
    cuentaDesde: "fabricación del acoplamiento",
    nota: "Sin alerta todavía: falta un campo para su fecha.",
    verificado: true,
  },
  {
    clave: "instrumentos-calibracion",
    nombre: "Manómetro, indicador de nivel y termómetro",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-009-ASEA-2026 (Auto-Tanques) y NOM-EM-008-ASEA-2026 (Semirremolques)",
    numeral: "Tabla 4, incisos g), h) e i) (Auto-Tanques) · Tabla 3 (Semirremolques)",
    cita: "El manómetro debe tener menos de 10 años desde su fabricación (o menos, si lo indica el fabricante). El indicador de nivel y el termómetro, carátula legible y aguja en funcionamiento.",
    cuentaDesde: "fabricación del manómetro",
    nota: "Sin alerta todavía: falta un campo para la fecha del manómetro. Los certificados de calibración van al expediente de integridad, sin plazo (NOM-EM-008, 7.5.2).",
    verificado: true,
  },
  {
    clave: "dictamen-instalacion",
    nombre: "Dictamen de la instalación",
    aplicaA: "Vehículos a gas",
    norma: "NOM-005-SESH-2010",
    numeral: "13",
    cita: "El dictamen de la instalación tiene vigencia máxima de 1 año desde su emisión.",
    cuentaDesde: "fecha del dictamen",
    nota: "Sin alerta todavía: falta un campo para su fecha.",
    verificado: true,
  },
];

// Normas que rigen cada área hoy. Las de transporte, distribución, plantas y
// equipos de carburación se cotejaron con el texto del DOF (21-oct-2026); la
// de estaciones de carburación todavía no se tiene.
export const NORMAS_VIGENTES: { area: string; norma: string; detalle: string }[] = [
  {
    area: "Transporte en auto-tanque y semirremolque (Kino)",
    norma: "NOM-EM-008-ASEA-2026",
    detalle: "DOF 2-oct-2026; en vigor desde el 6-oct-2026 por 6 meses. Reconoce los dictámenes de la NOM-EM-006-ASEA-2025.",
  },
  {
    area: "Distribución con auto-tanque y vehículo de reparto",
    norma: "NOM-EM-009-ASEA-2026",
    detalle: "DOF 5-oct-2026; en vigor desde el 6-oct-2026 por 6 meses. Reconoce los dictámenes de la NOM-EM-007-ASEA-2025.",
  },
  {
    area: "Plantas de distribución de gas LP",
    norma: "NOM-018-ASEA-2023",
    detalle: "DOF 5-dic-2023; en vigor 180 días después. Cancela y sustituye a la NOM-001-SESH-2014.",
  },
  {
    area: "Equipos de carburación de vehículos",
    norma: "NOM-005-SESH-2010",
    detalle: "DOF 26-nov-2010. Cancela a la NOM-005-SEDG-1999. No se encontró aviso de cancelación.",
  },
  {
    area: "Estaciones de carburación",
    norma: "Por confirmar",
    detalle:
      "Se cita la NOM-003-SEDG-2004 (DOF 28-abr-2005); la NOM-012-ASEA-2021 se menciona como su sustituta, pero solo se confirmó su proyecto. Falta tener el texto vigente.",
  },
];

export type RequisitoVigente = Requisito & {
  // Plazo con el que están calculando hoy las alertas (el ajustado o el base).
  plazoAnios: number | null;
  plazoBase: number | null;
  ajustado: boolean;
  actualizadoPor: string | null;
  actualizadoEl: Date | null;
};

export function plazoBaseDe(requisito: Requisito): number | null {
  return requisito.plazoClave ? PLAZOS_BASE[requisito.plazoClave] : null;
}
