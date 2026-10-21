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
    numeral: "Tabla 3 (7.4.5.1) y Tabla 4 (6.3.4, 7.2.2.12)",
    cita:
      "Válvulas de relevo de presión, exceso de flujo, no retroceso y llenado: antigüedad no mayor a 10 años desde su fecha de fabricación, o menor si el fabricante así lo recomienda. La fecha debe ser legible en el cuerpo de la válvula. Solo se reparan según las recomendaciones del fabricante.",
    cuentaDesde: "Fabricación de la válvula más antigua del juego",
    plazoClave: "valvulasTanqueCarga",
    nota: "La norma fija este plazo a esas 4 válvulas; la alerta lo aplica a todo el juego del tanque de carga. Además, el sistema no puede capturar el \"o menor si el fabricante así lo recomienda\".",
    verificado: false,
  },
  {
    clave: "valvulas-carburacion",
    nombre: "Válvulas del tanque de carburación",
    aplicaA: "Vehículo con tanque de carburación",
    norma: "NOM-005-SESH-2010",
    numeral: "9.6.4",
    cita:
      "Las válvulas de llenado, de servicio y de seguridad del recipiente se cambian cada 5 años como máximo, contados desde la fecha de fabricación marcada en la válvula. Si la válvula no tiene fecha, se toma la del recipiente y se anota en la bitácora.",
    cuentaDesde: "Fabricación de la válvula más antigua del juego",
    plazoClave: "valvulasCarburacion",
    verificado: true,
  },
  {
    clave: "manguera-trasiego",
    nombre: "Manguera de trasiego",
    aplicaA: "Auto-Tanques y Semirremolques (manguera de surtir)",
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "Tabla 4",
    cita:
      "Se sustituye al cumplir 5 años desde su fecha de fabricación. En la NOM-007-SESH-2010 se contaba desde la instalación.",
    cuentaDesde: "Fabricación de la manguera",
    plazoClave: "mangueraTrasiego",
    verificado: false,
  },
  {
    clave: "manguera-carburacion",
    nombre: "Manguera de presión no regulada",
    aplicaA: "Vehículo con tanque de carburación",
    norma: "NOM-005-SESH-2010",
    numeral: "9.6.6 y 9.6.7",
    cita:
      "Las mangueras de presión no regulada se cambian cada 2 años, contados desde el inicio de operación del sistema a gas. En vehículos a gas de fábrica se sigue el manual del fabricante; si no indica periodo para la manguera, aplican los 2 años.",
    cuentaDesde: "Fabricación de la manguera (la norma cuenta desde el inicio de operación del sistema)",
    plazoClave: "mangueraCarburacion",
    nota: "Diferencia: el sistema cuenta desde la fecha de fabricación capturada; la norma, desde el inicio de operación del sistema a gas.",
    verificado: false,
  },
  {
    clave: "valvulas-estacion",
    nombre: "Válvulas de la estación de carburación",
    aplicaA: "Estaciones de carburación",
    norma: "Sin norma capturada",
    numeral: "—",
    cita: "Se cambian a los 5 años de la fabricación de la válvula más antigua del tanque (criterio con el que se capturó el sistema).",
    cuentaDesde: "Fabricación de la válvula más antigua del tanque",
    plazoClave: "valvulasEstacion",
    nota: "Falta capturar la norma y el numeral que fundamentan este plazo.",
    verificado: false,
  },
  {
    clave: "instrumentos-planta",
    nombre: "Instrumentos y válvulas del tanque de la planta",
    aplicaA: "Planta",
    norma: "Sin norma capturada",
    numeral: "—",
    cita: "Cada instrumento se cambia a los 5 años de su último cambio o, si nunca se cambió, de su fabricación (criterio con el que se capturó el sistema).",
    cuentaDesde: "Último cambio del instrumento o, si no hay, su fabricación",
    plazoClave: "instrumentosPlanta",
    nota: "Falta capturar la norma y el numeral que fundamentan este plazo.",
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
    cita: "Mantenimiento preventivo cada 6 meses o cada 10,000 km, lo que ocurra primero, registrado en libro-bitácora.",
    cuentaDesde: "Último mantenimiento preventivo",
    nota: "El sistema avisa por fecha (6 meses); los 10,000 km se muestran como referencia porque no hay odómetro en vivo.",
    verificado: true,
  },
  {
    clave: "dictamen-espesores",
    nombre: "Dictamen de espesores del recipiente",
    aplicaA: "Vehículos a gas con recipiente de 10 años o más",
    norma: "NOM-005-SESH-2010",
    numeral: "9.6.5",
    cita: "Si el recipiente tiene 10 años o más, debe contar con dictamen vigente de espesores conforme a la NOM-013-SEDG-2002.",
    cuentaDesde: "Fabricación del tanque; después, cada ultrasonido",
    nota: "El sistema ya lo alerta con el ultrasonido (10 años la primera vez, luego 5).",
    verificado: false,
  },
  {
    clave: "valvula-interna",
    nombre: "Válvula interna",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "Tabla 4",
    cita: "No tiene plazo fijo. Debe contar con registros de su fecha de fabricación y tiempo de vida, y abrir y cerrar con el accionador.",
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
    cita: "En la inspección visual externa anual se comprueba que la válvula de relevo abre a su presión de ajuste y vuelve a cerrar herméticamente.",
    cuentaDesde: "Inspección visual externa",
    nota: "La fecha de la próxima inspección visual externa se captura a mano; todavía no se calcula sola a 1 año.",
    verificado: false,
  },
  {
    clave: "conectores-flexibles",
    nombre: "Conectores flexibles",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "Tabla 3 y Tabla 4",
    cita: "Se sustituyen al cumplir 5 años desde su fecha de fabricación. Longitud máxima de 1 m.",
    cuentaDesde: "Fabricación del conector",
    nota: "Sin alerta todavía: falta un campo donde capturar su fecha.",
    verificado: false,
  },
  {
    clave: "acoplamiento-desconexion-seca",
    nombre: "Acoplamiento de llenado de desconexión seca",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "Tabla 4",
    cita: "Mismo criterio de menos de 10 años que la válvula de llenado.",
    cuentaDesde: "Fabricación del acoplamiento",
    nota: "Sin alerta todavía: falta un campo donde capturar su fecha.",
    verificado: false,
  },
  {
    clave: "instrumentos-calibracion",
    nombre: "Indicador de nivel, manómetro y termómetro",
    aplicaA: "Auto-Tanques y Semirremolques",
    norma: "NOM-EM-008-ASEA-2026",
    numeral: "Tabla 4",
    cita: "No tienen plazo de cambio, pero deben contar con certificado de calibración.",
    cuentaDesde: "—",
    nota: "Sin alerta todavía: falta definir la periodicidad de la calibración.",
    verificado: false,
  },
  {
    clave: "dictamen-instalacion",
    nombre: "Dictamen de la instalación",
    aplicaA: "Vehículos a gas",
    norma: "NOM-005-SESH-2010",
    numeral: "13",
    cita: "El dictamen de la instalación tiene vigencia máxima de 1 año.",
    cuentaDesde: "Fecha del dictamen",
    nota: "Sin alerta todavía: falta un campo donde capturar su fecha.",
    verificado: false,
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
