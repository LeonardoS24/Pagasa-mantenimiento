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
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "Tabla 3 (7.4.5.1)",
    cita: "Las válvulas de relevo de presión, exceso de flujo, no retroceso y llenado deben tener menos de 10 años desde su fabricación, o menos si lo indica el fabricante.",
    cuentaDesde: "fabricación de la válvula más antigua",
    plazoClave: "valvulasTanqueCarga",
    nota: "La norma fija el plazo a esas 4 válvulas; la alerta lo aplica a todo el juego. Los 10 años coinciden con las emergencias anteriores (NOM-EM-006 y 007); no se pudo abrir la NOM-EM-008 para confirmar tabla y numeral.",
    verificado: false,
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
    aplicaA: "Auto-Tanques y Semirremolques (manguera de surtir)",
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "Tabla 4",
    cita: "Se sustituye a los 5 años desde su fecha de fabricación.",
    cuentaDesde: "fabricación de la manguera",
    plazoClave: "mangueraTrasiego",
    verificado: false,
  },
  {
    clave: "manguera-carburacion",
    nombre: "Manguera de presión no regulada",
    aplicaA: "Vehículo con tanque de carburación",
    norma: "NOM-005-SESH-2010",
    numeral: "9.6.6 y 9.6.7",
    cita: "Las mangueras de presión no regulada se cambian cada 2 años desde el inicio de operación del sistema a gas (en vehículos de fábrica, lo que indique el fabricante).",
    cuentaDesde: "fabricación de la manguera",
    plazoClave: "mangueraCarburacion",
    nota: "La norma cuenta desde el inicio de operación; el sistema, desde la fecha de fabricación capturada. El texto de 9.6.6 y 9.6.7 coincide con la cita del DOF (21-oct-2026); falta leer el original.",
    verificado: false,
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
    nota: "Falta confirmar la norma que fija este plazo. Es la que rige estaciones de carburación (hoy se cita la NOM-003-SEDG-2004; la NOM-012-ASEA-2021 se menciona como su sustituta): revisar su texto en el DOF.",
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
    nota: "Falta confirmar el numeral y el plazo. Un resumen de la NOM-018-ASEA-2023 dice que estos instrumentos se reemplazan según la vida útil del fabricante, sin plazo fijo: confirmarlo en el DOF.",
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
    nombre: "Dictamen de espesores del recipiente",
    aplicaA: "Vehículos a gas con recipiente de 10 años o más",
    norma: "NOM-005-SESH-2010",
    numeral: "9.6.5",
    cita: "Si el recipiente tiene 10 años o más, debe tener dictamen vigente de espesores.",
    cuentaDesde: "fabricación del tanque; después, cada ultrasonido",
    nota: "Ya se alerta con el ultrasonido (10 años la primera vez, luego 5). El texto del proyecto de la norma coincide; falta leer el definitivo.",
    verificado: false,
  },
  {
    clave: "valvula-interna",
    nombre: "Válvula interna",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "Tabla 4",
    cita: "Sin plazo fijo; debe tener registro de su fecha de fabricación y de su vida útil.",
    cuentaDesde: "—",
    nota: "Se guarda su fecha, pero no entra a la alerta.",
    verificado: false,
  },
  {
    clave: "valvula-relevo-prueba",
    nombre: "Prueba de la válvula de relevo",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "7.2.2.5.1 e)",
    cita: "En la inspección visual externa anual se comprueba que la válvula de relevo abre a su presión de ajuste y cierra herméticamente.",
    cuentaDesde: "inspección visual externa",
    nota: "La próxima inspección visual externa se captura a mano; aún no se calcula sola a 1 año.",
    verificado: false,
  },
  {
    clave: "conectores-flexibles",
    nombre: "Conectores flexibles",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "Tablas 3 y 4",
    cita: "Se sustituyen a los 5 años desde su fabricación; longitud máxima de 1 m.",
    cuentaDesde: "fabricación del conector",
    nota: "Sin alerta todavía: falta un campo para su fecha. Los 5 años y 1 m coinciden con la NOM-EM-006; falta confirmarlos en la NOM-EM-008.",
    verificado: false,
  },
  {
    clave: "acoplamiento-desconexion-seca",
    nombre: "Acoplamiento de llenado de desconexión seca",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "Tabla 4",
    cita: "Mismo criterio de menos de 10 años que la válvula de llenado.",
    cuentaDesde: "fabricación del acoplamiento",
    nota: "Sin alerta todavía: falta un campo para su fecha.",
    verificado: false,
  },
  {
    clave: "instrumentos-calibracion",
    nombre: "Indicador de nivel, manómetro y termómetro",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "Tabla 4",
    cita: "Sin plazo de cambio, pero con certificado de calibración.",
    cuentaDesde: "—",
    nota: "Sin alerta todavía: falta definir cada cuándo se calibran.",
    verificado: false,
  },
  {
    clave: "dictamen-instalacion",
    nombre: "Dictamen de la instalación",
    aplicaA: "Vehículos a gas",
    norma: "NOM-005-SESH-2010",
    numeral: "13",
    cita: "El dictamen de la instalación tiene vigencia máxima de 1 año.",
    cuentaDesde: "fecha del dictamen",
    nota: "Sin alerta todavía: falta un campo para su fecha. No se pudo confirmar el numeral ni el plazo de 1 año.",
    verificado: false,
  },
];

// Normas que rigen cada área hoy, según una búsqueda en fuentes públicas
// (oct-2026). No se pudo abrir el texto oficial de ninguna: antes de citarlas
// hacia fuera hay que cotejarlas en el DOF.
export const NORMAS_VIGENTES: { area: string; norma: string; detalle: string }[] = [
  {
    area: "Transporte en auto-tanque y semirremolque",
    norma: "NOM-EM-008-ASEA-2026",
    detalle: "DOF 2-oct-2026; vigente desde el 6-oct-2026 por 6 meses, mientras sale la norma definitiva.",
  },
  {
    area: "Distribución con auto-tanque y vehículo de reparto",
    norma: "NOM-EM-009-ASEA-2026",
    detalle: "Oct-2026, 6 meses de vigencia (las fuentes difieren en la fecha de publicación: 2 o 5 de octubre).",
  },
  {
    area: "Plantas de distribución de gas LP",
    norma: "NOM-018-ASEA-2023",
    detalle: "DOF 5-dic-2023; cancela y sustituye a la NOM-001-SESH-2014.",
  },
  {
    area: "Estaciones de carburación",
    norma: "NOM-003-SEDG-2004 (por confirmar)",
    detalle:
      "DOF 28-abr-2005. La NOM-012-ASEA-2021 se cita como su sustituta, pero solo se confirmó su proyecto (29-abr-2021): confirmar en el DOF cuál rige hoy.",
  },
  {
    area: "Equipos de carburación de vehículos",
    norma: "NOM-005-SESH-2010",
    detalle: "DOF 26-nov-2010. No se encontró aviso de cancelación.",
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
