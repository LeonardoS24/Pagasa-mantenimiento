import type { VehicleTechnicalSheet } from "@prisma/client";

// Listas de campos de la ficha técnica que se pintan igual en el
// formulario, la vista de solo lectura, la hoja impresa y el Excel. Antes
// cada pantalla repetía su propia lista; con estas, agregar un campo es
// tocar un solo lugar.

type CampoFecha = {
  [K in keyof VehicleTechnicalSheet]: VehicleTechnicalSheet[K] extends Date | null ? K : never;
}[keyof VehicleTechnicalSheet];
type CampoTexto = {
  [K in keyof VehicleTechnicalSheet]: VehicleTechnicalSheet[K] extends string | null ? K : never;
}[keyof VehicleTechnicalSheet];

export type ValvulaDef = {
  fecha: CampoFecha;
  codigo: CampoTexto;
  etiqueta: string;
  // false = dato de referencia, no participa en la alerta de 5 años (ver
  // lib/valve-alerts.ts y el comentario en el schema).
  entraEnAlerta: boolean;
};

// Nombres y orden tal como vienen en el Excel de flotilla que se levantó en
// campo. Entre paréntesis va el otro nombre solo cuando es seguro que se
// trata de la misma válvula (alivio = seguridad, no retroceso = check,
// llenado de carburación = doble check). Servicio de vapor y descarga de
// emergencia no vienen en ese Excel y siguen aparte: no está confirmado si
// son la misma que "retorno de vapores" e "interna", respectivamente.

// Juego del tanque de carga (Auto-Tanques y Semirremolques). La de máximo
// llenado 85% va aparte porque es opcional (ver tieneValvulaMaximoLlenado85).
export const VALVULAS_TANQUE_CARGA: ValvulaDef[] = [
  { fecha: "fechaFabricacionValvulaLlenado", codigo: "codigoValvulaLlenado", etiqueta: "Válvula de llenado", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaNoRetroceso", codigo: "codigoValvulaNoRetroceso", etiqueta: "Válvula de no retroceso (check)", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaBypass", codigo: "codigoValvulaBypass", etiqueta: "Válvula de bypass", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaRetornoVapores", codigo: "codigoValvulaRetornoVapores", etiqueta: "Válvula de retorno de vapores", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaMaximoLlenado", codigo: "codigoValvulaMaximoLlenado", etiqueta: "Válvula de máximo llenado 90%", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaAlivio", codigo: "codigoValvulaAlivio", etiqueta: "Válvula de alivio (seguridad)", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaExcesoFlujo", codigo: "codigoValvulaExcesoFlujo", etiqueta: "Válvula de exceso de flujo (litrómetro)", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaCheckLock", codigo: "codigoValvulaCheckLock", etiqueta: "Válvula check lock", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaInterna", codigo: "codigoValvulaInterna", etiqueta: "Válvula interna", entraEnAlerta: false },
  // No vienen en el Excel de flotilla (ver arriba).
  { fecha: "fechaFabricacionValvulaServicio", codigo: "codigoValvulaServicio", etiqueta: "Válvula de servicio de vapor", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaDescargaEmergencia", codigo: "codigoValvulaDescargaEmergencia", etiqueta: "Válvula de descarga de emergencia", entraEnAlerta: true },
];

export const VALVULA_MAXIMO_LLENADO_85: ValvulaDef = {
  fecha: "fechaFabricacionValvulaMaximoLlenado85",
  codigo: "codigoValvulaMaximoLlenado85",
  etiqueta: "Válvula de máximo llenado 85%",
  entraEnAlerta: true,
};

// Vehículo con tanque de carburación: solo 4, en el orden del Excel.
export const VALVULAS_CARBURACION: ValvulaDef[] = [
  { fecha: "fechaFabricacionValvulaLlenado", codigo: "codigoValvulaLlenado", etiqueta: "Válvula de llenado (doble check)", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaServicio", codigo: "codigoValvulaServicio", etiqueta: "Válvula de servicio", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaMaximoLlenado", codigo: "codigoValvulaMaximoLlenado", etiqueta: "Válvula de máximo llenado 90%", entraEnAlerta: true },
  { fecha: "fechaFabricacionValvulaAlivio", codigo: "codigoValvulaAlivio", etiqueta: "Válvula de alivio (seguridad)", entraEnAlerta: true },
];

export type CampoTextoDef = { campo: CampoTexto; etiqueta: string };

// Tractocamión (Transportadora Kino): lo que trae la ficha técnica armada
// con la factura de compra. "potencia" ya existía en la ficha.
export const CAMPOS_TRACTOCAMION: { grupo: string; campos: CampoTextoDef[] }[] = [
  {
    grupo: "Identificación",
    campos: [
      { campo: "claveVehicular", etiqueta: "Clave vehicular" },
      { campo: "facturaNumero", etiqueta: "Número de factura" },
      { campo: "facturaFecha", etiqueta: "Fecha de factura" },
    ],
  },
  {
    grupo: "Motor",
    campos: [
      { campo: "motorMarca", etiqueta: "Fabricante del motor" },
      { campo: "motorModelo", etiqueta: "Modelo del motor" },
      { campo: "potencia", etiqueta: "Potencia" },
      { campo: "motorTorque", etiqueta: "Torque" },
      { campo: "numeroMotor", etiqueta: "Número de motor" },
    ],
  },
  {
    grupo: "Transmisión",
    campos: [
      { campo: "transmisionMarca", etiqueta: "Fabricante de la transmisión" },
      { campo: "transmisionModelo", etiqueta: "Modelo de la transmisión" },
      { campo: "transmisionVelocidades", etiqueta: "Velocidades" },
      { campo: "numeroTransmision", etiqueta: "Número de transmisión" },
    ],
  },
  {
    grupo: "Ejes, suspensión y cabina",
    campos: [
      { campo: "ejeDelantero", etiqueta: "Eje delantero" },
      { campo: "ejesTraseros", etiqueta: "Ejes traseros" },
      { campo: "suspension", etiqueta: "Suspensión" },
      { campo: "cabina", etiqueta: "Cabina" },
      { campo: "dormitorio", etiqueta: "Dormitorio" },
      { campo: "quintaRueda", etiqueta: "Quinta rueda" },
    ],
  },
];

// Semirremolque (Transportadora Kino): identificación y datos del
// certificado de fabricación del recipiente que no caben en la placa del
// tanque (placa* en el schema, que ya se muestran en "Tanque").
export const CAMPOS_SEMIRREMOLQUE: { grupo: string; campos: CampoTextoDef[] }[] = [
  {
    grupo: "Identificación",
    campos: [
      { campo: "numeroPemex", etiqueta: "Número Pemex" },
      { campo: "idCre", etiqueta: "ID CRE / CNE" },
    ],
  },
  {
    grupo: "Fabricación del recipiente",
    campos: [
      { campo: "fabricadoPara", etiqueta: "Fabricado para" },
      { campo: "ordenTrabajo", etiqueta: "Orden de trabajo (O.T.)" },
      { campo: "factorSeguridad", etiqueta: "Factor de seguridad" },
      { campo: "sobreespesorCorrosion", etiqueta: "Sobreespesor por corrosión" },
      { campo: "soldadura", etiqueta: "Soldadura de cuerpo y cabezas" },
      { campo: "relevadoEsfuerzos", etiqueta: "Relevado de esfuerzos" },
      { campo: "pruebasFabricacion", etiqueta: "Pruebas de fabricación" },
      { campo: "presionPruebaHidrostatica", etiqueta: "Presión de prueba hidrostática" },
      { campo: "resultadoPruebas", etiqueta: "Resultado de las pruebas" },
    ],
  },
];

// Todos los campos de texto nuevos que guarda upsertTechnicalSheet solo si
// vienen en el formulario (ver actions/vehicle-actions.ts): un formulario
// que no los pinta (p. ej. el de un Vehículo de reparto) no los borra.
export const CAMPOS_TEXTO_CONSERVABLES: CampoTexto[] = [
  ...new Set<CampoTexto>([
    ...VALVULAS_TANQUE_CARGA.map((v) => v.codigo),
    VALVULA_MAXIMO_LLENADO_85.codigo,
    ...CAMPOS_TRACTOCAMION.flatMap((g) => g.campos.map((c) => c.campo)),
    ...CAMPOS_SEMIRREMOLQUE.flatMap((g) => g.campos.map((c) => c.campo)),
    "medidaMangueraSurtir",
    "numeroGobernador",
    "empresaGobernador",
    "unidadAsignada",
  ]),
];

export const CAMPOS_FECHA_CONSERVABLES: CampoFecha[] = [
  "fechaFabricacionValvulaExcesoFlujo",
  "fechaFabricacionValvulaCheckLock",
  "fechaFabricacionValvulaInterna",
  "fechaFabricacionMangueraSurtir",
];
